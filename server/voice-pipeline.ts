import { createWriteStream, mkdirSync, existsSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { Readable } from "node:stream";

// ─── Voice mapping ────────────────────────────────────────────────────────────
const EDGE_VOICES: Record<string, string> = {
  "fr-female":    "fr-FR-DeniseNeural",
  "fr-male":      "fr-FR-HenriNeural",
  "en-female":    "en-US-JennyNeural",
  "en-male":      "en-US-GuyNeural",
  "en-female-2":  "en-US-AriaNeural",
  "en-male-calm": "en-US-DavisNeural",
  "es-female":    "es-ES-ElviraNeural",
  "de-female":    "de-DE-KatjaNeural",
};

// Windows SAPI voices
const SAPI_VOICES: Record<string, string> = {
  "fr-female":    "Microsoft Hortense Desktop",
  "fr-male":      "Microsoft Hortense Desktop",
  "en-female":    "Microsoft Zira Desktop",
  "en-male":      "Microsoft David Desktop",
  "en-female-2":  "Microsoft Zira Desktop",
  "en-male-calm": "Microsoft David Desktop",
  "es-female":    "Microsoft Zira Desktop",
  "de-female":    "Microsoft Zira Desktop",
};

// espeak-ng voices (Linux)
const ESPEAK_VOICES: Record<string, string> = {
  "fr-female":    "fr",
  "fr-male":      "fr",
  "en-female":    "en",
  "en-male":      "en",
  "en-female-2":  "en",
  "en-male-calm": "en",
  "es-female":    "es",
  "de-female":    "de",
};

export const VOICES = EDGE_VOICES;
export type VoiceKey = keyof typeof EDGE_VOICES;

export interface GenerateVoiceOptions {
  script: string;
  voice?: VoiceKey;
  outputDir: string;
  filename?: string;
  rate?: string;
}

export interface VoiceResult {
  filepath: string;
  filename: string;
  durationMs: number;
}

function fileHasContent(p: string): boolean {
  try { return existsSync(p) && statSync(p).size > 100; } catch { return false; }
}

function cleanup(...paths: string[]) {
  for (const p of paths) try { if (existsSync(p)) unlinkSync(p); } catch {}
}

// ─── Method 1: Edge-TTS (neural, internet required) ──────────────────────────
async function tryEdgeTTS(script: string, voiceName: string, mp3Path: string, timeoutMs = 12000): Promise<boolean> {
  const tmpPath = mp3Path + ".tmp";
  cleanup(tmpPath);
  try {
    const { MsEdgeTTS, OUTPUT_FORMAT } = await import("msedge-tts");
    const tts = new MsEdgeTTS();
    await Promise.race([
      tts.setMetadata(voiceName, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3),
      new Promise<never>((_, r) => setTimeout(() => r(new Error("connect timeout")), timeoutMs)),
    ]);
    await Promise.race([
      new Promise<void>((resolve, reject) => {
        const ws = createWriteStream(tmpPath);
        const readable = tts.toStream(script) as unknown as Readable;
        readable.pipe(ws);
        ws.on("finish", resolve);
        ws.on("error", reject);
        readable.on("error", reject);
      }),
      new Promise<never>((_, r) => setTimeout(() => r(new Error("stream timeout")), timeoutMs)),
    ]);
    if (!fileHasContent(tmpPath)) { cleanup(tmpPath); return false; }
    const { renameSync } = await import("node:fs");
    cleanup(mp3Path);
    renameSync(tmpPath, mp3Path);
    return true;
  } catch {
    cleanup(tmpPath);
    return false;
  }
}

// ─── Method 2: Windows SAPI (offline, Windows only) ──────────────────────────
function tryWindowsSAPI(script: string, voiceName: string, mp3Path: string, rateNum = 2): boolean {
  if (process.platform !== "win32") return false;
  const wavPath = mp3Path + ".sapi.wav";
  cleanup(wavPath, mp3Path);
  try {
    const safeScript = script.replace(/'/g, "''").replace(/[^\x20-\x7E\u00C0-\u024F]/g, " ");
    const winWav = wavPath.replace(/\//g, "\\");
    const ps = [
      "Add-Type -AssemblyName System.Speech",
      "$s = New-Object System.Speech.Synthesis.SpeechSynthesizer",
      `try { $s.SelectVoice('${voiceName}') } catch {}`,
      `$s.Rate = ${rateNum}`,
      `$s.SetOutputToWaveFile('${winWav}')`,
      `$s.Speak('${safeScript}')`,
      "$s.Dispose()",
    ].join(";");
    const r1 = spawnSync("powershell", ["-NoProfile", "-NonInteractive", "-Command", ps], { timeout: 20000, encoding: "utf8" });
    if (r1.status !== 0 || !fileHasContent(wavPath)) { cleanup(wavPath); return false; }
    const winMp3 = mp3Path.replace(/\//g, "\\");
    const r2 = spawnSync("ffmpeg", ["-y", "-i", winWav, "-q:a", "3", "-ar", "22050", winMp3], { timeout: 30000, encoding: "utf8" });
    cleanup(wavPath);
    return r2.status === 0 && fileHasContent(mp3Path);
  } catch {
    cleanup(wavPath);
    return false;
  }
}

// ─── Method 3: espeak-ng (offline, Linux) ────────────────────────────────────
function tryEspeakNg(script: string, lang: string, mp3Path: string, speed = 150): boolean {
  if (process.platform === "win32") return false;
  const wavPath = mp3Path + ".espeak.wav";
  const txtPath = mp3Path + ".txt";
  cleanup(wavPath, mp3Path, txtPath);
  try {
    writeFileSync(txtPath, script, "utf8");
    const r1 = spawnSync("espeak-ng", ["-v", lang, "-s", String(speed), "-f", txtPath, "-w", wavPath], { timeout: 20000, encoding: "utf8" });
    cleanup(txtPath);
    if (r1.status !== 0 || !fileHasContent(wavPath)) { cleanup(wavPath); return false; }
    const r2 = spawnSync("ffmpeg", ["-y", "-i", wavPath, "-q:a", "4", "-ar", "22050", mp3Path], { timeout: 30000, encoding: "utf8" });
    cleanup(wavPath);
    return r2.status === 0 && fileHasContent(mp3Path);
  } catch {
    cleanup(wavPath, txtPath);
    return false;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────
export async function generateVoiceOver(opts: GenerateVoiceOptions): Promise<VoiceResult> {
  const {
    script,
    voice = "en-female",
    outputDir,
    filename = `voice-${Date.now()}.mp3`,
    rate = "+5%",
  } = opts;

  mkdirSync(outputDir, { recursive: true });
  const mp3Path = path.join(outputDir, filename);
  const t0 = Date.now();

  console.info(`[VOICE] Generating: "${script.slice(0, 60)}..." (${process.platform})`);

  // 1. Edge-TTS (neural, best quality)
  const edgeVoice = EDGE_VOICES[voice];
  if (edgeVoice && await tryEdgeTTS(script, edgeVoice, mp3Path)) {
    console.info(`[VOICE] ✅ Edge-TTS in ${Date.now() - t0}ms`);
    return { filepath: mp3Path, filename, durationMs: Date.now() - t0 };
  }
  console.warn("[VOICE] Edge-TTS unavailable");

  // 2. Windows SAPI (Windows only)
  const sapiVoice = SAPI_VOICES[voice];
  const rateNum = Math.round(parseInt(rate.replace(/[+%]/g, "") || "0") / 5);
  if (sapiVoice && tryWindowsSAPI(script, sapiVoice, mp3Path, rateNum)) {
    console.info(`[VOICE] ✅ SAPI in ${Date.now() - t0}ms`);
    return { filepath: mp3Path, filename, durationMs: Date.now() - t0 };
  }

  // 3. espeak-ng (Linux fallback)
  const espeakLang = ESPEAK_VOICES[voice] ?? "en";
  if (tryEspeakNg(script, espeakLang, mp3Path)) {
    console.info(`[VOICE] ✅ espeak-ng in ${Date.now() - t0}ms`);
    return { filepath: mp3Path, filename, durationMs: Date.now() - t0 };
  }

  throw new Error("All TTS methods failed (Edge-TTS, SAPI, espeak-ng)");
}

export function splitScriptToScenes(script: string, numScenes: number): string[] {
  const sentences = script
    .replace(/([.!?])\s+/g, "$1\n")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  if (sentences.length <= numScenes) {
    while (sentences.length < numScenes) sentences.push(sentences[sentences.length - 1]);
    return sentences.slice(0, numScenes);
  }

  const result: string[] = [];
  const perGroup = Math.ceil(sentences.length / numScenes);
  for (let i = 0; i < numScenes; i++) {
    result.push(sentences.slice(i * perGroup, (i + 1) * perGroup).join(" "));
  }
  return result;
}
