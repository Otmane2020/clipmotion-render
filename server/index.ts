import "dotenv/config";
import express from "express";
import { makeRenderQueue } from "./render-queue";
import { generateAiVideoScenes } from "./ai-pipeline";
import { generateVoiceOver, splitScriptToScenes } from "./voice-pipeline";
import { fetchStockAssets } from "./stock-pipeline";
import { renderVideoFFmpeg } from "./ffmpeg-pipeline";
import { isStorageConfigured, uploadAndClean } from "./storage";
import { bundle } from "@remotion/bundler";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { ensureBrowser } from "@remotion/renderer";
import { mkdirSync } from "node:fs";

const {
  PORT = 3000,
  REMOTION_SERVE_URL,
  CONCURRENCY = "1",
  HF_TOKEN,
} = process.env;

// ─── Template ID → Remotion compositionId ────────────────────────────────────
const TEMPLATE_MAP: Record<string, string> = {
  "template-prompt-to-video": "KenBurnsVideo",
  "KenBurnsVideo": "KenBurnsVideo",
  "QuoteReel": "QuoteReel",
  "PodcastClip": "PodcastClip",
  "SaaSPromo": "SaaSPromo",
  "InstaReel": "InstaReel",
  "HelloWorld": "HelloWorld",
  "PromoVideo": "PromoVideo",
  "PromoVideoReel": "PromoVideoReel",
  "PromoVideoSquare": "PromoVideoSquare",
};

function resolveComposition(templateId: string): string {
  return TEMPLATE_MAP[templateId] ?? templateId;
}

function setupApp({ remotionBundleUrl }: { remotionBundleUrl: string }) {
  const app = express();
  const rendersDir = path.resolve("renders");
  const aiAssetsDir = path.resolve("ai-assets");
  mkdirSync(rendersDir, { recursive: true });
  mkdirSync(aiAssetsDir, { recursive: true });

  const queue = makeRenderQueue({
    port: Number(PORT),
    serveUrl: remotionBundleUrl,
    rendersDir,
    concurrency: Number(CONCURRENCY),
  });

  // ── CORS — allow Lovable app + any origin ───────────────────────────────────
  app.use((_req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, apikey");
    if (_req.method === "OPTIONS") { res.sendStatus(204); return; }
    next();
  });

  // ── Static files ────────────────────────────────────────────────────────────
  app.use("/renders", express.static(rendersDir));
  app.use("/ai-assets", express.static(aiAssetsDir));
  app.use(express.json({ limit: "10mb" }));

  // ── Health ──────────────────────────────────────────────────────────────────
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", version: "3.8", hfConfigured: !!HF_TOKEN });
  });

  app.get("/compositions", (_req, res) => {
    res.json({ available: Object.keys(TEMPLATE_MAP) });
  });

  // ── POST /renders — API générique ───────────────────────────────────────────
  // Body: { compositionId, inputProps, webhookUrl?, format? }
  app.post("/renders", async (req, res) => {
    const { compositionId, inputProps = {}, webhookUrl, format = "mp4" } = req.body ?? {};

    if (!compositionId || typeof compositionId !== "string") {
      res.status(400).json({ error: "compositionId is required" });
      return;
    }

    const jobId = queue.createJob({
      compositionId: resolveComposition(compositionId),
      inputProps,
      webhookUrl,
      format,
    });
    res.status(202).json({ jobId, status: "queued" });
  });

  // ── POST /render — compatible avec la Supabase edge function existante ──────
  // Body: { templateId, titleText, audioUrl, duration, imageUrl, width, height,
  //         webhookUrl, generationId, crf, concurrency }
  app.post("/render", async (req, res) => {
    const {
      templateId = "KenBurnsVideo",
      titleText = "My Video",
      audioUrl,
      duration = 10,
      imageUrl,
      width = 1280,
      height = 720,
      webhookUrl,
      generationId,
    } = req.body ?? {};

    const isVertical = height > width;

    // Construire les inputProps selon la composition
    const compositionId = resolveComposition(templateId);
    let inputProps: Record<string, unknown> = {};

    if (compositionId === "KenBurnsVideo") {
      const fps = 30;
      const sceneDuration = Math.floor((duration * fps) / 3);
      inputProps = {
        title: titleText,
        brandName: "clipmotion.ai",
        accentColor: "#6c47ff",
        audioUrl: audioUrl || null,
        scenes: [
          { imageUrl: imageUrl || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1920&q=80", caption: titleText, durationInFrames: sceneDuration, panDirection: "zoom-in" },
          { imageUrl: imageUrl || "https://images.unsplash.com/photo-1535223289827-42f1e9919769?w=1920&q=80", caption: "Created with AI", durationInFrames: sceneDuration, panDirection: "left" },
          { imageUrl: imageUrl || "https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?w=1920&q=80", caption: "clipmotion.ai", durationInFrames: sceneDuration, panDirection: "zoom-out" },
        ],
      };
    } else if (compositionId === "QuoteReel") {
      inputProps = {
        quote: titleText,
        author: "AI Generated",
        role: "clipmotion.ai",
        accentColor: "#ff6b35",
        highlightWords: [],
        bgColor: "#0a0a0a",
      };
    } else {
      inputProps = { titleText };
    }

    const jobId = queue.createJob({
      compositionId,
      inputProps,
      webhookUrl,
      format: "mp4",
      meta: { generationId },
    });

    res.status(202).json({ jobId, status: "queued", generationId });
  });

  // ── GET /renders/:jobId — status ────────────────────────────────────────────
  app.get("/renders/:jobId", (req, res) => {
    const job = queue.jobs.get(req.params.jobId);
    if (!job) { res.status(404).json({ error: "Job not found" }); return; }

    // Normalise pour compatibilité Supabase (status "done" attendu)
    const normalized = {
      ...job,
      status: job.status === "completed" ? "done" : job.status,
      output: "videoUrl" in job ? job.videoUrl : undefined,
    };
    res.json(normalized);
  });

  // ── DELETE /renders/:jobId — annuler ────────────────────────────────────────
  app.delete("/renders/:jobId", (req, res) => {
    const job = queue.jobs.get(req.params.jobId);
    if (!job) { res.status(404).json({ error: "Job not found" }); return; }
    if (job.status !== "queued" && job.status !== "in-progress") {
      res.status(400).json({ error: "Job is not cancellable" }); return;
    }
    job.cancel();
    res.json({ message: "Cancelled" });
  });

  // ── POST /generate-ai-video — FLUX images + FFmpeg (no Chrome) ─────────────
  // Body: { prompt, title, style, accentColor, brandName, webhookUrl, generationId }
  app.post("/generate-ai-video", async (req, res) => {
    const {
      prompt,
      title = prompt,
      style = "cinematic",
      accentColor = "#6c47ff",
      brandName = "clipmotion.ai",
      webhookUrl,
      generationId,
    } = req.body ?? {};

    if (!prompt) {
      res.status(400).json({ error: "prompt is required" });
      return;
    }

    const jobId = randomUUID();
    const dummyData = { compositionId: "FFmpegRender", inputProps: {}, webhookUrl };
    queue.jobs.set(jobId, { status: "in-progress", progress: 0.05, cancel: () => {}, data: dummyData });

    res.status(202).json({ jobId, status: "queued", message: "Generating AI images with FLUX.1..." });

    setImmediate(async () => {
      try {
        console.info(`[AI-VIDEO] Generating scenes for: "${prompt}"`);

        // Try FLUX image generation, fall back to Unsplash
        const SCENE_SEC = 4; // seconds per scene (short = faster FFmpeg on low-CPU)
        let ffmpegScenes;
        try {
          const result = await generateAiVideoScenes({
            prompt, title, style, accentColor, brandName,
            sceneDuration: Math.round(SCENE_SEC * 30), // kept in frames for ai-pipeline compat
            outputDir: aiAssetsDir,
            serverPort: Number(PORT),
          });
          ffmpegScenes = result.scenes.map((s) => ({
            localPath: path.join(aiAssetsDir, path.basename(s.imageUrl.split("/ai-assets/")[1] ?? s.imageUrl)),
            caption: s.caption,
            duration: SCENE_SEC,
            panDirection: s.panDirection,
          }));
          console.info(`[AI-VIDEO] FLUX images ready: ${result.scenes.length} scenes`);
        } catch (fluxErr) {
          console.warn("[AI-VIDEO] FLUX failed, using Unsplash fallback:", (fluxErr as Error).message);
          ffmpegScenes = [
            { url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1280&q=80", caption: title, duration: SCENE_SEC, panDirection: "zoom-in" as const },
            { url: "https://images.unsplash.com/photo-1535223289827-42f1e9919769?w=1280&q=80", caption: "Created with AI", duration: SCENE_SEC, panDirection: "left" as const },
            { url: "https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?w=1280&q=80", caption: brandName, duration: SCENE_SEC, panDirection: "zoom-out" as const },
          ];
        }

        queue.jobs.set(jobId, { status: "in-progress", progress: 0.4, cancel: () => {}, data: dummyData });

        const outputPath = await renderVideoFFmpeg({
          scenes: ffmpegScenes,
          width: 640, height: 360,   // 360p — safe on 0.5 vCPU (8x fewer pixels vs 720p)
          fps: 24, crf: 24,
          outputDir: rendersDir,
        });

        let videoUrl: string;
        if (isStorageConfigured()) {
          videoUrl = await uploadAndClean(outputPath, `${jobId}.mp4`, true);
        } else {
          videoUrl = `http://localhost:${PORT}/renders/${path.basename(outputPath)}`;
        }

        queue.jobs.set(jobId, { status: "completed", videoUrl, data: dummyData });
        console.info(`[AI-VIDEO] Done: ${videoUrl}`);

        if (webhookUrl) {
          await fetch(webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ jobId, status: "completed", videoUrl, generationId }),
          }).catch(() => {});
        }
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        console.error("[AI-VIDEO] Pipeline error:", error);
        queue.jobs.set(jobId, { status: "failed", error, data: dummyData });
        if (webhookUrl) {
          await fetch(webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ jobId, status: "failed", error, generationId }),
          }).catch(() => {});
        }
      }
    });
  });

  // ── POST /render-callback ────────────────────────────────────────────────────
  app.post("/render-callback", (req, res) => {
    console.info("[CALLBACK]", req.body);
    res.json({ received: true });
  });

  // ── POST /generate-promo-video — pipeline COMPLET ────────────────────────────
  // FLUX images + Edge-TTS voix off + Pexels vidéos + Pixabay musique + Remotion
  // Body: {
  //   prompt, script, title, subtitle,
  //   voice, mood, style, accentColor, brandName,
  //   useAiImages, sceneDuration,
  //   webhookUrl, generationId
  // }
  // videoFormat: "landscape" (1920×1080) | "reel" (1080×1920) | "square" (1080×1080)
  // quality: "high" (crf 16) | "medium" (crf 22) | "low" (crf 28) — default "high"
  app.post("/generate-promo-video", async (req, res) => {
    const {
      prompt = "",
      script = prompt,
      title = prompt.split(" ").slice(0, 5).join(" "),
      subtitle = "",
      voice = "en-female",
      mood = "cinematic",
      style = "cinematic",
      accentColor = "#6c47ff",
      secondaryColor = "#ff6b6b",
      brandName = "clipmotion.ai",
      useAiImages = false,
      sceneDuration = 20,
      videoFormat = "landscape",
      quality = "medium",
      webhookUrl,
      generationId,
    } = req.body ?? {};

    if (!prompt && !script) {
      res.status(400).json({ error: "prompt or script is required" });
      return;
    }

    // Resolve dimensions
    const FORMAT_MAP: Record<string, { width: number; height: number }> = {
      landscape: { width: 854, height: 480 },  // 480p — fits in 512MB with Pixabay videos
      reel:      { width: 480, height: 854 },
      mobile:    { width: 480, height: 854 },
      vertical:  { width: 480, height: 854 },
      square:    { width: 480, height: 480 },
    };
    const CRF_MAP: Record<string, number> = { high: 16, medium: 22, low: 28 };
    const { width, height } = FORMAT_MAP[videoFormat] ?? FORMAT_MAP.landscape;
    const crf = CRF_MAP[quality] ?? 16;

    const promoJobId = randomUUID();
    const promoDummyData = { compositionId: "FFmpegRender", inputProps: {}, webhookUrl };
    queue.jobs.set(promoJobId, { status: "in-progress", progress: 0.05, cancel: () => {}, data: promoDummyData });
    res.status(202).json({ jobId: promoJobId, status: "generating", generationId, videoFormat, width, height });

    setImmediate(async () => {
      try {
        console.info(`[PROMO] Starting pipeline: "${prompt}" [${videoFormat} ${width}×${height} CRF${crf}]`);
        const NUM_SCENES = 3;

        // ── 1. Voix off (Edge-TTS neural → SAPI fallback) ──
        let voiceFilename: string | undefined;
        if (script) {
          try {
            const { filename } = await generateVoiceOver({
              script,
              voice: voice as any,
              outputDir: aiAssetsDir,
              filename: `voice-${Date.now()}.mp3`,
              rate: "+5%",
            });
            voiceFilename = filename;
            console.info(`[PROMO] ✅ Voice: ${filename}`);
          } catch (e) {
            console.warn("[PROMO] Voice skipped:", (e as Error).message);
          }
        }

        // ── 2. Stock assets (Pixabay videos → Pexels → Unsplash) ──
        const [stockAssets, aiScenes] = await Promise.all([
          fetchStockAssets(prompt, mood as any, NUM_SCENES),
          useAiImages
            ? generateAiVideoScenes({ prompt, title, style, accentColor, brandName, sceneDuration, outputDir: aiAssetsDir, serverPort: Number(PORT) })
            : Promise.resolve(null),
        ]);

        // ── 3. Build clips (real video URLs — no Chrome, FFmpeg handles mp4 natively) ──
        const captions = splitScriptToScenes(script || title, NUM_SCENES);
        const clips = aiScenes?.scenes ?? stockAssets.videoClips.map((v, i) => ({
          url: v.url,
          type: v.type,   // "video" for Pixabay/Pexels clips, "image" for Unsplash fallback
          caption: captions[i] || title,
          durationInFrames: sceneDuration,
          panDirection: (["zoom-in", "left", "zoom-out"] as const)[i % 3],
        }));

        const totalFrames = 50 + clips.length * sceneDuration;

        // ── 4. Render (FFmpeg — no Chrome, fits in 512MB) ──
        const fps = 25;
        const sceneSec = Math.max(4, Math.round(sceneDuration / 30 * 10) / 10); // frames→sec, min 4s
        const ffmpegScenes = clips.map((c: any) => ({
          url: c.url as string,
          type: (c.type as "image" | "video") ?? "image",
          caption: (c.caption as string) || title,
          duration: sceneSec,
          panDirection: (c.panDirection as any) ?? "zoom-in",
        }));

        queue.jobs.set(promoJobId, { status: "in-progress", progress: 0.5, cancel: () => {}, data: promoDummyData });

        const outputPath = await renderVideoFFmpeg({
          scenes: ffmpegScenes,
          musicUrl: stockAssets.musicUrl || undefined,
          musicVolume: 0.12,
          voicePath: voiceFilename ? path.join(aiAssetsDir, voiceFilename) : undefined,
          width, height, fps, crf,
          outputDir: rendersDir,
        });

        let videoUrl: string;
        if (isStorageConfigured()) {
          videoUrl = await uploadAndClean(outputPath, `${promoJobId}.mp4`, true);
        } else {
          const publicHost = process.env.PUBLIC_URL || `http://localhost:${PORT}`;
          videoUrl = `${publicHost}/renders/${path.basename(outputPath)}`;
        }

        queue.jobs.set(promoJobId, { status: "completed", videoUrl, data: promoDummyData });
        console.info(`[PROMO] ✅ Done: ${videoUrl} | Voice: ${!!voiceFilename} | Music: ${(stockAssets.musicUrl || "").slice(0, 40)}`);

        if (webhookUrl) {
          await fetch(webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ jobId: promoJobId, status: "completed", videoUrl, generationId }),
          }).catch(() => {});
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error("[PROMO] Pipeline error:", errMsg);
        queue.jobs.set(promoJobId, { status: "failed", error: errMsg, data: promoDummyData });
        if (webhookUrl) {
          await fetch(webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "failed", error: errMsg, generationId }),
          }).catch(() => {});
        }
      }
    });
  });

  return app;
}

async function main() {
  console.info("🎬 Starting ClipMotion render server v3...");

  if (!HF_TOKEN) {
    console.warn("⚠️  HF_TOKEN not set — HuggingFace free tier (rate limited)");
  }

  await ensureBrowser();

  const remotionBundleUrl = REMOTION_SERVE_URL
    ? REMOTION_SERVE_URL
    : await bundle({
        entryPoint: path.resolve("remotion/index.ts"),
        onProgress(p) { process.stdout.write(`\rBundling: ${p}%   `); },
      });

  console.info("\n✅ Bundle ready");

  const app = setupApp({ remotionBundleUrl });
  app.listen(PORT, () => {
    console.info(`\n🚀 ClipMotion render server on http://localhost:${PORT}`);
    console.info(`   POST /generate-promo-video  { prompt, script, voice, mood, style } ← MAIN`);
    console.info(`   POST /generate-ai-video     { prompt, title, style }`);
    console.info(`   POST /render                { templateId, titleText, webhookUrl }`);
    console.info(`   POST /renders               { compositionId, inputProps, webhookUrl }`);
    console.info(`   GET  /renders/:jobId        → status + videoUrl`);
  });
}

main().catch(console.error);
