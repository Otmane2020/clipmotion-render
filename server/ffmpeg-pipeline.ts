import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

const execFileAsync = promisify(execFile);

const FONT_CANDIDATES = [
  "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
  "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
  "/usr/share/fonts/truetype/freefont/FreeSansBold.ttf",
];
const FONT_PATH = FONT_CANDIDATES.find((f) => fs.existsSync(f));

export interface FFmpegScene {
  url?: string;        // Remote URL to download
  localPath?: string;  // Already-local file (skips download)
  caption?: string;
  duration: number;    // Seconds
  panDirection?: "zoom-in" | "zoom-out" | "left" | "right" | "none";
}

export interface FFmpegRenderOptions {
  scenes: FFmpegScene[];
  musicUrl?: string;
  musicVolume?: number;
  voicePath?: string;  // Local MP3 path for voice-over
  width?: number;
  height?: number;
  fps?: number;
  crf?: number;
  outputDir: string;
}

async function downloadToFile(url: string, dest: string): Promise<void> {
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  const buf = await res.arrayBuffer();
  await fsp.writeFile(dest, Buffer.from(buf));
}

function escapeDrawtext(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "")      // strip single-quotes (used as delimiters)
    .replace(/:/g, "\\:")   // escape colon (filter option separator)
    .replace(/%/g, "%%")    // escape percent (drawtext variable prefix)
    .slice(0, 60);
}

function zoompanFilter(dir: string, frames: number, w: number, h: number): string {
  const size = `${w}x${h}`;
  const D = frames;
  switch (dir) {
    case "zoom-in":
      return `zoompan=z='min(zoom+0.0015,1.5)':x='(iw-iw/zoom)/2':y='(ih-ih/zoom)/2':d=${D}:s=${size}`;
    case "zoom-out":
      return `zoompan=z='if(lte(zoom,1.0),1.5,max(1.001,zoom-0.0015))':x='(iw-iw/zoom)/2':y='(ih-ih/zoom)/2':d=${D}:s=${size}`;
    case "left":
      return `zoompan=z='1.3':x='(iw-iw/zoom)*n/${D}':y='(ih-ih/zoom)/2':d=${D}:s=${size}`;
    case "right":
      return `zoompan=z='1.3':x='(iw-iw/zoom)*(1-n/${D})':y='(ih-ih/zoom)/2':d=${D}:s=${size}`;
    default:
      return `zoompan=z='1.0':x='0':y='0':d=${D}:s=${size}`;
  }
}

export async function renderVideoFFmpeg(opts: FFmpegRenderOptions): Promise<string> {
  const {
    scenes,
    musicUrl,
    musicVolume = 0.15,
    voicePath,
    width = 1280,
    height = 720,
    fps = 25,
    crf = 23,
    outputDir,
  } = opts;

  if (!scenes.length) throw new Error("No scenes provided");

  const jobId = randomUUID();
  const tmpDir = path.join(outputDir, `tmp-${jobId}`);
  const outputPath = path.join(outputDir, `${jobId}.mp4`);

  await fsp.mkdir(tmpDir, { recursive: true });

  try {
    // ── 1. Resolve image files ───────────────────────────────────────────────
    const imagePaths: string[] = [];
    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      if (scene.localPath) {
        imagePaths.push(scene.localPath);
      } else if (scene.url) {
        const dest = path.join(tmpDir, `img-${i}.jpg`);
        await downloadToFile(scene.url, dest);
        imagePaths.push(dest);
      } else {
        throw new Error(`Scene ${i}: no url or localPath`);
      }
    }

    // ── 2. Resolve audio files ───────────────────────────────────────────────
    let musicPath: string | undefined;
    if (musicUrl) {
      musicPath = path.join(tmpDir, "music.mp3");
      try {
        await downloadToFile(musicUrl, musicPath);
      } catch (e) {
        console.warn("[FFMPEG] Music download failed, skipping:", (e as Error).message);
        musicPath = undefined;
      }
    }

    // ── 3. Build FFmpeg args ─────────────────────────────────────────────────
    const args: string[] = ["-hide_banner", "-loglevel", "warning"];

    for (let i = 0; i < scenes.length; i++) {
      args.push("-framerate", String(fps), "-loop", "1", "-t", String(scenes[i].duration), "-i", imagePaths[i]);
    }

    let nextInputIdx = scenes.length;
    const musicInputIdx = musicPath ? nextInputIdx++ : undefined;
    const voiceInputIdx = voicePath ? nextInputIdx++ : undefined;
    if (musicPath) args.push("-i", musicPath);
    if (voicePath) args.push("-i", voicePath);

    // ── 4. filter_complex ────────────────────────────────────────────────────
    const parts: string[] = [];
    const totalDuration = scenes.reduce((s, sc) => s + sc.duration, 0);
    const fontOpt = FONT_PATH ? `fontfile=${FONT_PATH}:` : "";

    for (let i = 0; i < scenes.length; i++) {
      const { duration, caption, panDirection = "zoom-in" } = scenes[i];
      const frames = Math.round(duration * fps);

      // Scale + crop to exact output dimensions
      parts.push(
        `[${i}:v]scale=${width}:${height}:force_original_aspect_ratio=increase,` +
          `crop=${width}:${height},setsar=1,fps=${fps}[sc${i}]`,
      );

      // Ken Burns effect
      parts.push(`[sc${i}]${zoompanFilter(panDirection, frames, width, height)}[kb${i}]`);

      // Caption overlay
      if (caption) {
        const esc = escapeDrawtext(caption);
        parts.push(
          `[kb${i}]drawtext=${fontOpt}` +
            `text='${esc}':fontsize=38:fontcolor=white:` +
            `box=1:boxcolor=black@0.55:boxborderw=12:` +
            `x=(w-text_w)/2:y=h-text_h-50[out${i}]`,
        );
      } else {
        parts.push(`[kb${i}]null[out${i}]`);
      }
    }

    // Concat scenes
    const concatIn = scenes.map((_, i) => `[out${i}]`).join("");
    parts.push(`${concatIn}concat=n=${scenes.length}:v=1:a=0,format=yuv420p[vout]`);

    // Audio mixing
    let audioMap: string | undefined;
    const fadeStart = Math.max(0, totalDuration - 2);
    if (musicInputIdx !== undefined && voiceInputIdx !== undefined) {
      parts.push(
        `[${musicInputIdx}:a]volume=${musicVolume},afade=t=out:st=${fadeStart}:d=2[mfade]`,
        `[${voiceInputIdx}:a]volume=1.0[vclean]`,
        `[mfade][vclean]amix=inputs=2:duration=longest[aout]`,
      );
      audioMap = "[aout]";
    } else if (musicInputIdx !== undefined) {
      parts.push(
        `[${musicInputIdx}:a]volume=${musicVolume},` +
          `afade=t=out:st=${fadeStart}:d=2,atrim=duration=${totalDuration}[aout]`,
      );
      audioMap = "[aout]";
    } else if (voiceInputIdx !== undefined) {
      parts.push(`[${voiceInputIdx}:a]volume=1.0[aout]`);
      audioMap = "[aout]";
    }

    args.push("-filter_complex", parts.join(";"));
    args.push("-map", "[vout]");
    if (audioMap) args.push("-map", audioMap);

    args.push("-c:v", "libx264", "-crf", String(crf), "-preset", "fast");
    if (audioMap) args.push("-c:a", "aac", "-b:a", "128k");
    args.push("-movflags", "+faststart", "-y", outputPath);

    console.info(
      `[FFMPEG] ${scenes.length} scenes · ${totalDuration}s · ${width}×${height} · CRF${crf}`,
    );

    const { stderr } = await execFileAsync("ffmpeg", args, {
      maxBuffer: 100 * 1024 * 1024,
      timeout: 15 * 60 * 1000,
    });
    if (stderr) console.warn("[FFMPEG] warnings:", stderr.slice(-500));

    console.info(`[FFMPEG] Done → ${path.basename(outputPath)}`);
    return outputPath;
  } finally {
    await fsp.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}
