import { InferenceClient } from "@huggingface/inference";
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const HF_TOKEN = process.env.HF_TOKEN; // optionnel — augmente les quotas

const hf = new InferenceClient(HF_TOKEN);

export interface AiScene {
  imageUrl: string;       // chemin local servi statiquement
  caption: string;
  durationInFrames: number;
  panDirection: "zoom-in" | "zoom-out" | "left" | "right";
}

const PAN_DIRECTIONS: AiScene["panDirection"][] = ["zoom-in", "left", "zoom-out", "right"];

// Génère une image FLUX.1-schnell (gratuit HuggingFace) et la sauvegarde
async function generateSceneImage(
  prompt: string,
  outputDir: string,
  index: number
): Promise<string> {
  console.info(`[AI] Generating image ${index + 1}: "${prompt.slice(0, 60)}..."`);

  const blob = await hf.textToImage({
    model: "black-forest-labs/FLUX.1-schnell",
    inputs: prompt,
    parameters: { width: 1024, height: 576 }, // 16:9
  });

  const buffer = Buffer.from(await blob.arrayBuffer());
  const filename = `scene-${Date.now()}-${index}.jpg`;
  const filepath = path.join(outputDir, filename);
  writeFileSync(filepath, buffer);

  return filename; // relatif à outputDir
}

// Décompose un prompt en 3-4 scènes visuelles distinctes
function buildScenePrompts(mainPrompt: string, style: string = "cinematic"): string[] {
  const stylePrefix = {
    cinematic: "cinematic 4K photography, professional lighting,",
    anime: "anime style, vivid colors, Studio Ghibli inspired,",
    realistic: "photorealistic, highly detailed, sharp focus,",
    minimal: "minimalist, clean design, white background,",
  }[style] || "cinematic 4K photography,";

  // Créer des variantes du prompt pour avoir des visuels différents
  return [
    `${stylePrefix} ${mainPrompt}, wide establishing shot`,
    `${stylePrefix} ${mainPrompt}, close-up detail shot, bokeh`,
    `${stylePrefix} ${mainPrompt}, aerial perspective, golden hour lighting`,
  ];
}

export interface GenerateAiVideoOptions {
  prompt: string;
  title: string;
  style?: string;
  accentColor?: string;
  brandName?: string;
  fps?: number;
  sceneDuration?: number; // frames par scène
  outputDir: string;
  serverPort: number;
}

export interface GenerateAiVideoResult {
  scenes: AiScene[];
  title: string;
  brandName: string;
  accentColor: string;
  totalFrames: number;
}

export async function generateAiVideoScenes(
  opts: GenerateAiVideoOptions
): Promise<GenerateAiVideoResult> {
  const {
    prompt,
    title,
    style = "cinematic",
    accentColor = "#6c47ff",
    brandName = "clipmotion.ai",
    sceneDuration = 90,
    outputDir,
    serverPort,
  } = opts;

  mkdirSync(outputDir, { recursive: true });

  const scenePrompts = buildScenePrompts(prompt, style);

  // Générer toutes les images en parallèle
  const imageFilenames = await Promise.all(
    scenePrompts.map((p, i) => generateSceneImage(p, outputDir, i))
  );

  const captions = [
    title,
    prompt.split(" ").slice(0, 6).join(" ") + "...",
    "Created with clipmotion.ai",
  ];

  const INTRO_FRAMES = 45;

  const scenes: AiScene[] = imageFilenames.map((filename, i) => ({
    imageUrl: `http://localhost:${serverPort}/ai-assets/${filename}`,
    caption: captions[i] || captions[0],
    durationInFrames: sceneDuration,
    panDirection: PAN_DIRECTIONS[i % PAN_DIRECTIONS.length],
  }));

  return {
    scenes,
    title,
    brandName,
    accentColor,
    totalFrames: INTRO_FRAMES + scenes.length * sceneDuration,
  };
}
