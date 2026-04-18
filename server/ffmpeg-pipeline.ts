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
  url?: string;                          // Remote URL to download
  localPath?: string;                    // Already-local file (skips download)
  type?: "image" | "video";             // Default "image"
  caption?: string;
  duration: number;                      // Seconds
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
    // ── 1. Resolve scene inputs ──────────────────────────────────────────────
    // Videos: pass URL directly to FFmpeg (streams only what it needs — avoids OOM)
    // Images: download to disk (small JPEG, safe)
    const inputSources: string[] = [];
    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      if (scene.localPath) {
        inputSources.push(scene.localPath);
      } else if (scene.url) {
        if (scene.type === "video") {
          // FFmpeg reads the remote stream with -t cap — no full download needed
          inputSources.push(scene.url);
        } else {
          const dest = path.join(tmpDir, `scene-${i}.jpg`);
          await downloadToFile(scene.url, dest);
          inputSources.push(dest);
        }
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
    // -threads 1 prevents FFmpeg from consuming all vCPU and starving the Node.js event loop
    const args: string[] = ["-hide_banner", "-loglevel", "warning", "-threads", "1"];

    for (let i = 0; i < scenes.length; i++) {
      const { type = "image", panDirection = "none" } = scenes[i];
      const isVideo = type === "video";
      const usesZoompan = !isVideo && panDirection !== "none";

      if (isVideo) {
        // Video URL: limit stream reading to scene duration (avoids full download)
        args.push("-t", String(scenes[i].duration));
      } else {
        // Still image: loop for full scene duration at target fps
        args.push("-t", String(scenes[i].duration), "-r", String(fps), "-loop", "1");
      }
      args.push("-i", inputSources[i]);
    }

    let nextInputIdx = scenes.length;
    const musicInputIdx = musicPath ? nextInputIdx++ : undefined;
    const voiceInputIdx = voicePath ? nextInputIdx++ : undefined;
    if (musicPath) args.push("-i", musicPath);
    if (voicePath) args.push("-i", voicePath);

    // ── 4. filter_complex ────────────────────────────────────────────────────
    const parts: string[] = [];
    const FADE = 0.5; // crossfade duration in seconds
    const totalDuration = scenes.reduce((s, sc) => s + sc.duration, 0) - FADE * (scenes.length - 1);
    const fontOpt = FONT_PATH ? `fontfile=${FONT_PATH}:` : "";

    // Overscan scale for Ken Burns crop animation (15% extra pixels to pan within)
    const KB_SCALE = 1.15;
    const oW = Math.round(width * KB_SCALE);
    const oH = Math.round(height * KB_SCALE);
    // Extra pixels available for panning
    const padX = oW - width;  // e.g. 128px for 854→982
    const padY = oH - height; // e.g. 72px  for 480→552

    for (let i = 0; i < scenes.length; i++) {
      const { caption, type = "image", panDirection = "none" } = scenes[i];
      const dur = scenes[i].duration;

      // For video clips: trim to duration + reset pts. For images: already loop-limited.
      const trimPart = type === "video"
        ? `trim=duration=${dur},setpts=PTS-STARTPTS,`
        : "";

      // Ken Burns via crop filter — uses `t` variable (seconds), renders in <1s per scene
      // No zoompan (which generates d frames PER input frame → duration bug on looped inputs)
      let kbFilter = "";
      if (type === "image" && panDirection !== "none") {
        // All expressions use t=elapsed seconds, clamped to [0,dur]
        const tc = `min(t,${dur})`;  // clamped t
        const prog = `(${tc}/${dur})`; // 0→1 progress
        if (panDirection === "zoom-in") {
          // Pan from top-left offset toward center
          kbFilter = `,crop=${width}:${height}:x='${padX}*${prog}':y='${padY}*${prog}'`;
        } else if (panDirection === "zoom-out") {
          // Pan from center toward top-left
          kbFilter = `,crop=${width}:${height}:x='${padX}*(1-${prog})':y='${padY}*(1-${prog})'`;
        } else if (panDirection === "left") {
          // Pan left→right along x, centered y
          kbFilter = `,crop=${width}:${height}:x='${padX}*${prog}':y='${padY}/2'`;
        } else if (panDirection === "right") {
          // Pan right→left
          kbFilter = `,crop=${width}:${height}:x='${padX}*(1-${prog})':y='${padY}/2'`;
        }
      }

      if (kbFilter) {
        // Scale to overscan → animated crop → fps → yuv420p
        parts.push(
          `[${i}:v]${trimPart}scale=${oW}:${oH}:force_original_aspect_ratio=increase,` +
            `crop=${oW}:${oH},setsar=1${kbFilter},fps=${fps},format=yuv420p[sc${i}]`,
        );
      } else {
        // Static (video clips or panDirection=none)
        parts.push(
          `[${i}:v]${trimPart}scale=${width}:${height}:force_original_aspect_ratio=increase,` +
            `crop=${width}:${height},setsar=1,fps=${fps},format=yuv420p[sc${i}]`,
        );
      }

      // Caption overlay
      if (caption) {
        const esc = escapeDrawtext(caption);
        parts.push(
          `[sc${i}]drawtext=${fontOpt}` +
            `text='${esc}':fontsize=38:fontcolor=white:` +
            `box=1:boxcolor=black@0.55:boxborderw=12:` +
            `x=(w-text_w)/2:y=h-text_h-50[out${i}]`,
        );
      } else {
        parts.push(`[sc${i}]copy[out${i}]`);
      }
    }

    // Chain xfade transitions between scenes
    let lastLabel = "[out0]";
    let xfadeOffset = scenes[0].duration - FADE;
    for (let i = 1; i < scenes.length; i++) {
      const nextLabel = i === scenes.length - 1 ? "[xfinal]" : `[xf${i}]`;
      parts.push(
        `${lastLabel}[out${i}]xfade=transition=fade:duration=${FADE}:offset=${xfadeOffset.toFixed(3)}${nextLabel}`,
      );
      lastLabel = nextLabel;
      xfadeOffset += scenes[i].duration - FADE;
    }

    // Single scene: no xfade needed, just rename
    if (scenes.length === 1) {
      parts.push(`[out0]copy[xfinal]`);
    }

    parts.push(`[xfinal]format=yuv420p[vout]`);

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
    // Explicit color metadata — Chrome refuses to play h264 with color_range=unknown
    args.push("-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv");
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
