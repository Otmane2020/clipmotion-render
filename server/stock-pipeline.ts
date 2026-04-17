const PEXELS_KEY = process.env.PEXELS_API_KEY;
const PIXABAY_KEY = process.env.PIXABAY_API_KEY;

// ─── Fallback music — Kevin MacLeod (incompetech.com, CC BY 4.0) ─────────────
const FREE_MUSIC_BY_MOOD: Record<string, string[]> = {
  motivational: [
    "https://incompetech.com/music/royalty-free/mp3-royaltyfree/Impact%20Moderato.mp3",
    "https://incompetech.com/music/royalty-free/mp3-royaltyfree/Funky%20Chunk.mp3",
  ],
  calm: [
    "https://incompetech.com/music/royalty-free/mp3-royaltyfree/Chill.mp3",
    "https://incompetech.com/music/royalty-free/mp3-royaltyfree/Meditation%20Impromptu%2001.mp3",
  ],
  upbeat: [
    "https://incompetech.com/music/royalty-free/mp3-royaltyfree/Sneaky%20Snitch.mp3",
    "https://incompetech.com/music/royalty-free/mp3-royaltyfree/Carefree.mp3",
  ],
  cinematic: [
    "https://incompetech.com/music/royalty-free/mp3-royaltyfree/Impact%20Moderato.mp3",
    "https://incompetech.com/music/royalty-free/mp3-royaltyfree/Cipher.mp3",
  ],
};

// Fallback images Unsplash (no key required)
const UNSPLASH_FALLBACKS: Record<string, string[]> = {
  business: [
    "https://images.unsplash.com/photo-1497366216548-37526070297c?w=1920&q=80",
    "https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=1920&q=80",
    "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1920&q=80",
  ],
  technology: [
    "https://images.unsplash.com/photo-1518770660439-4636190af475?w=1920&q=80",
    "https://images.unsplash.com/photo-1535223289827-42f1e9919769?w=1920&q=80",
    "https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?w=1920&q=80",
  ],
  nature: [
    "https://images.unsplash.com/photo-1501854140801-50d01698950b?w=1920&q=80",
    "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=1920&q=80",
    "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1920&q=80",
  ],
  people: [
    "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=1920&q=80",
    "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=1920&q=80",
    "https://images.unsplash.com/photo-1543269664-56d93c1b41a6?w=1920&q=80",
  ],
  food: [
    "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1920&q=80",
    "https://images.unsplash.com/photo-1482049016688-2d3e1b311543?w=1920&q=80",
    "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=1920&q=80",
  ],
  fitness: [
    "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=1920&q=80",
    "https://images.unsplash.com/photo-1518611012118-696072aa579a?w=1920&q=80",
    "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=1920&q=80",
  ],
  default: [
    "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1920&q=80",
    "https://images.unsplash.com/photo-1535223289827-42f1e9919769?w=1920&q=80",
    "https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?w=1920&q=80",
  ],
};

export interface StockVideo {
  url: string;
  type: "video" | "image";
  thumb: string;
}

export interface StockAssets {
  videoClips: StockVideo[];
  musicUrl: string;
  hasPexels: boolean;
  hasPixabay: boolean;
}

// ─── Category detection ───────────────────────────────────────────────────────
function detectCategory(prompt: string): keyof typeof UNSPLASH_FALLBACKS {
  const p = prompt.toLowerCase();
  if (/tech|ai|software|app|digital|code|startup/.test(p)) return "technology";
  if (/food|cook|recipe|restaurant|eat/.test(p)) return "food";
  if (/nature|outdoor|forest|ocean|mountain/.test(p)) return "nature";
  if (/people|team|community|social/.test(p)) return "people";
  if (/fitness|sport|gym|health|workout/.test(p)) return "fitness";
  if (/business|corporate|office|work|brand/.test(p)) return "business";
  return "default";
}

function fetchWithTimeout(url: string, ms = 8000): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { signal: ctrl.signal }).finally(() => clearTimeout(timer));
}

// ─── Pixabay videos ───────────────────────────────────────────────────────────
async function searchPixabayVideos(query: string, count = 3): Promise<StockVideo[]> {
  if (!PIXABAY_KEY) return [];
  try {
    const url = `https://pixabay.com/api/videos/?key=${PIXABAY_KEY}&q=${encodeURIComponent(query)}&per_page=${count}&video_type=film&orientation=horizontal`;
    const res = await fetchWithTimeout(url);
    if (!res.ok) return [];
    const data = await res.json() as any;
    return (data.hits || []).slice(0, count).map((hit: any) => {
      const v = hit.videos ?? {};
      // Pick smallest variant with width >= 1280 to avoid huge files
      const sizes = [v.tiny, v.small, v.medium, v.large].filter(Boolean);
      const good = sizes.find((s: any) => s.width >= 1280) ?? sizes[sizes.length - 1];
      return {
        url: good?.url ?? "",
        type: "video" as const,
        thumb: hit.userImageURL ?? "",
      };
    }).filter((v: StockVideo) => v.url);
  } catch {
    return [];
  }
}

// ─── Pixabay images (fallback if no videos) ───────────────────────────────────
async function searchPixabayImages(query: string, count = 3): Promise<StockVideo[]> {
  if (!PIXABAY_KEY) return [];
  try {
    const url = `https://pixabay.com/api/?key=${PIXABAY_KEY}&q=${encodeURIComponent(query)}&image_type=photo&orientation=horizontal&per_page=${count}&min_width=1280&safesearch=true`;
    const res = await fetchWithTimeout(url);
    if (!res.ok) return [];
    const data = await res.json() as any;
    return (data.hits || []).slice(0, count).map((hit: any) => ({
      url: hit.largeImageURL ?? hit.webformatURL,
      type: "image" as const,
      thumb: hit.previewURL,
    }));
  } catch {
    return [];
  }
}

// ─── Pexels videos ────────────────────────────────────────────────────────────
async function searchPexelsVideos(query: string, count = 3): Promise<StockVideo[]> {
  if (!PEXELS_KEY) return [];
  try {
    const res = await fetchWithTimeout(
      `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=${count}&size=medium&orientation=landscape`,
      { headers: { Authorization: PEXELS_KEY } }
    );
    if (!res.ok) return [];
    const data = await res.json() as any;
    return (data.videos || []).map((v: any) => {
      const file = v.video_files?.find((f: any) => f.quality === "sd" || f.quality === "hd");
      return { url: file?.link ?? v.url, type: "video" as const, thumb: v.image };
    });
  } catch {
    return [];
  }
}

// Pixabay audio CDN blocks direct streaming — always use incompetech fallbacks
async function searchPixabayMusic(_mood: string): Promise<string | null> {
  return null;
}

// ─── Main export ──────────────────────────────────────────────────────────────
export async function fetchStockAssets(
  prompt: string,
  mood: "motivational" | "calm" | "upbeat" | "cinematic" = "cinematic",
  count = 3
): Promise<StockAssets> {
  const category = detectCategory(prompt);

  // Run all searches in parallel
  const [pixabayVideos, pexelsVideos, pixabayMusic] = await Promise.all([
    searchPixabayVideos(prompt, count),
    searchPexelsVideos(prompt, count),
    searchPixabayMusic(mood),
  ]);

  let videoClips: StockVideo[];
  let hasPexels = false;
  let hasPixabay = false;

  if (pixabayVideos.length > 0) {
    // Pixabay videos first (free, no watermark)
    videoClips = pixabayVideos;
    hasPixabay = true;
    console.info(`[STOCK] Pixabay videos — ${videoClips.length} clips`);
  } else if (pexelsVideos.length > 0) {
    // Pexels as second option
    videoClips = pexelsVideos;
    hasPexels = true;
    console.info(`[STOCK] Pexels videos — ${videoClips.length} clips`);
  } else {
    // Fallback: Pixabay images, then Unsplash
    const pixabayImgs = await searchPixabayImages(prompt, count);
    if (pixabayImgs.length > 0) {
      videoClips = pixabayImgs;
      hasPixabay = true;
      console.info(`[STOCK] Pixabay images fallback — ${videoClips.length} clips`);
    } else {
      videoClips = (UNSPLASH_FALLBACKS[category] || UNSPLASH_FALLBACKS.default)
        .slice(0, count)
        .map((url) => ({ url, type: "image" as const, thumb: url }));
      console.info(`[STOCK] Unsplash fallback — ${videoClips.length} clips`);
    }
  }

  const moodMusic = FREE_MUSIC_BY_MOOD[mood] || FREE_MUSIC_BY_MOOD.cinematic;
  const musicUrl = pixabayMusic || moodMusic[0];

  console.info(`[STOCK] Music: ${pixabayMusic ? "Pixabay" : "CDN fallback"}`);

  return { videoClips, musicUrl, hasPexels, hasPixabay };
}
