import "dotenv/config";
import express from "express";
import { makeRenderQueue } from "./render-queue";
import { generateAiVideoScenes } from "./ai-pipeline";
import { generateVoiceOver, splitScriptToScenes } from "./voice-pipeline";
import { fetchStockAssets } from "./stock-pipeline";
import { bundle } from "@remotion/bundler";
import path from "node:path";
import { ensureBrowser } from "@remotion/renderer";
import { mkdirSync } from "node:fs";

const {
  PORT = 3000,
  REMOTION_SERVE_URL,
  CONCURRENCY = "2",
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
    res.json({ status: "ok", version: "3.1", hfConfigured: !!HF_TOKEN });
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

  // ── POST /generate-ai-video — Pipeline FLUX + Remotion ─────────────────────
  // Corps: { prompt, title, style, accentColor, brandName, webhookUrl, generationId }
  app.post("/generate-ai-video", async (req, res) => {
    const {
      prompt,
      title = prompt,
      style = "cinematic",
      accentColor = "#6c47ff",
      brandName = "clipmotion.ai",
      webhookUrl,
      generationId,
      sceneDuration = 60,
    } = req.body ?? {};

    if (!prompt) {
      res.status(400).json({ error: "prompt is required" });
      return;
    }

    // Fallback scenes used immediately so we have a jobId to return right away
    const fps = 30;
    const fallbackScenes = [
      { imageUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1920&q=80", caption: title, durationInFrames: sceneDuration, panDirection: "zoom-in" },
      { imageUrl: "https://images.unsplash.com/photo-1535223289827-42f1e9919769?w=1920&q=80", caption: "Created with AI", durationInFrames: sceneDuration, panDirection: "left" },
      { imageUrl: "https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?w=1920&q=80", caption: brandName, durationInFrames: sceneDuration, panDirection: "zoom-out" },
    ];

    // Render at 960×540 (half of 1920×1080) to stay within 512MB RAM on free tier.
    // Each frame is 4× smaller → Chrome stays well under the OOM threshold.
    const renderWidth  = 960;
    const renderHeight = 540;

    // Create pending job immediately — caller gets a real jobId to poll
    const jobId = queue.createPendingJob({
      compositionId: "KenBurnsVideo",
      inputProps: { scenes: fallbackScenes, title, brandName, accentColor },
      webhookUrl,
      format: "mp4",
      width: renderWidth,
      height: renderHeight,
      meta: { generationId },
    });

    res.status(202).json({ jobId, status: "queued", message: "Generating AI images with FLUX.1..." });

    // Generate FLUX images in background, then resolve the pending job
    setImmediate(async () => {
      try {
        console.info(`[AI-VIDEO] Generating scenes for: "${prompt}"`);

        const result = await generateAiVideoScenes({
          prompt,
          title,
          style,
          accentColor,
          brandName,
          sceneDuration,
          outputDir: aiAssetsDir,
          serverPort: Number(PORT),
        });

        const resolved = queue.resolveJob(jobId, {
          scenes: result.scenes,
          title: result.title,
          brandName: result.brandName,
          accentColor: result.accentColor,
        });

        console.info(`[AI-VIDEO] Render job resolved: ${jobId} (used FLUX: ${resolved})`);
      } catch (err) {
        console.error("[AI-VIDEO] FLUX failed, falling back to Unsplash images:", err);
        // Resolve with fallback scenes so the video still renders
        queue.resolveJob(jobId, { scenes: fallbackScenes, title, brandName, accentColor });
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
      sceneDuration = 90,
      videoFormat = "landscape",  // ← NEW
      quality = "high",           // ← NEW
      webhookUrl,
      generationId,
    } = req.body ?? {};

    if (!prompt && !script) {
      res.status(400).json({ error: "prompt or script is required" });
      return;
    }

    // Resolve dimensions
    const FORMAT_MAP: Record<string, { width: number; height: number }> = {
      landscape: { width: 1920, height: 1080 },
      reel:      { width: 1080, height: 1920 },
      mobile:    { width: 1080, height: 1920 },
      vertical:  { width: 1080, height: 1920 },
      square:    { width: 1080, height: 1080 },
    };
    const CRF_MAP: Record<string, number> = { high: 16, medium: 22, low: 28 };
    const { width, height } = FORMAT_MAP[videoFormat] ?? FORMAT_MAP.landscape;
    const crf = CRF_MAP[quality] ?? 16;

    const jobPlaceholderId = `promo-${Date.now()}`;
    res.status(202).json({ jobId: jobPlaceholderId, status: "generating", generationId, videoFormat, width, height });

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

        // ── 3. Build clips ──
        const captions = splitScriptToScenes(script || title, NUM_SCENES);
        const clips = aiScenes?.scenes ?? stockAssets.videoClips.map((v, i) => ({
          url: v.url,
          type: v.type,
          caption: captions[i] || title,
          durationInFrames: sceneDuration,
          panDirection: (["zoom-in", "left", "zoom-out"] as const)[i % 3],
        }));

        const totalFrames = 50 + clips.length * sceneDuration;

        // ── 4. Render ──
        const jobId = queue.createJob({
          compositionId: "PromoVideo",
          inputProps: {
            clips, title, subtitle, brandName, accentColor, secondaryColor, style,
            musicUrl: stockAssets.musicUrl,
            musicVolume: 0.12,
            voiceUrl: voiceFilename ? `http://localhost:${PORT}/ai-assets/${voiceFilename}` : undefined,
          },
          webhookUrl,
          format: "mp4",
          width,
          height,
          crf,
          meta: { generationId, totalFrames, videoFormat },
        });

        console.info(`[PROMO] ✅ Render job: ${jobId} | Voice: ${!!voiceFilename} | Music: ${stockAssets.musicUrl.slice(0, 40)}`);

        if (webhookUrl) {
          await fetch(webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ jobId, status: "rendering", generationId }),
          }).catch(() => {});
        }
      } catch (err) {
        console.error("[PROMO] Pipeline error:", err);
        if (webhookUrl) {
          await fetch(webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              status: "failed",
              error: err instanceof Error ? err.message : String(err),
              generationId,
            }),
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
