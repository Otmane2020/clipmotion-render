import React from "react";
import {
  AbsoluteFill,
  Audio,
  Img,
  OffthreadVideo,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

// ─── Types ────────────────────────────────────────────────────────────────────
export interface PromoClip {
  url: string;
  type: "video" | "image";
  caption: string;
  durationInFrames: number;
  panDirection?: "zoom-in" | "zoom-out" | "left" | "right";
}

export interface PromoVideoProps {
  clips: PromoClip[];
  voiceUrl?: string;
  musicUrl?: string;
  musicVolume?: number;
  title: string;
  subtitle?: string;
  brandName: string;
  accentColor: string;
  secondaryColor?: string;
  style?: "modern" | "cinematic" | "bold" | "minimal";
}

export const PromoVideoDefaultProps: PromoVideoProps = {
  title: "Discover clipmotion.ai",
  subtitle: "Create viral videos in seconds",
  brandName: "clipmotion.ai",
  accentColor: "#6c47ff",
  secondaryColor: "#ff6b6b",
  musicVolume: 0.15,
  style: "cinematic",
  clips: [
    { url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1920&q=80", type: "image", caption: "AI-powered creativity", durationInFrames: 90, panDirection: "zoom-in" },
    { url: "https://images.unsplash.com/photo-1535223289827-42f1e9919769?w=1920&q=80", type: "image", caption: "Built for creators", durationInFrames: 90, panDirection: "left" },
    { url: "https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?w=1920&q=80", type: "image", caption: "Go viral instantly", durationInFrames: 90, panDirection: "zoom-out" },
  ],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function useScale() {
  const { width, height } = useVideoConfig();
  // Base scale relative to 1920×1080 landscape
  return Math.min(width, height * (16 / 9)) / 1920;
}

// ─── Media clip with Ken Burns ────────────────────────────────────────────────
const MediaClip: React.FC<{ clip: PromoClip }> = ({ clip }) => {
  const frame = useCurrentFrame();
  const dur = clip.durationInFrames;
  const progress = frame / dur;

  let scale = 1;
  let tx = 0;
  switch (clip.panDirection ?? "zoom-in") {
    case "zoom-in":  scale = interpolate(progress, [0, 1], [1, 1.12]); break;
    case "zoom-out": scale = interpolate(progress, [0, 1], [1.12, 1]); break;
    case "left":  scale = 1.10; tx = interpolate(progress, [0, 1], [0, -4]); break;
    case "right": scale = 1.10; tx = interpolate(progress, [0, 1], [0,  4]); break;
  }

  const fadeIn  = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [dur - 10, dur], [1, 0], { extrapolateLeft: "clamp" });

  return (
    <AbsoluteFill style={{ opacity: Math.min(fadeIn, fadeOut) }}>
      <div style={{ width: "100%", height: "100%", overflow: "hidden" }}>
        {clip.type === "video" ? (
          <OffthreadVideo
            src={clip.url}
            style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${scale}) translateX(${tx}%)` }}
          />
        ) : (
          <Img
            src={clip.url}
            style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${scale}) translateX(${tx}%)`, transformOrigin: "center" }}
          />
        )}
      </div>
      {/* Vignette */}
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at center, transparent 35%, rgba(0,0,0,0.65) 100%)" }} />
    </AbsoluteFill>
  );
};

// ─── Caption (adaptatif vertical/landscape) ───────────────────────────────────
const CinemaCaption: React.FC<{
  text: string;
  accent: string;
  secondary: string;
  clipDuration: number;
  style: string;
  isVertical: boolean;
}> = ({ text, accent, secondary, clipDuration, style, isVertical }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = useScale();

  const enter = spring({ fps, frame: Math.max(0, frame - 6), config: { damping: 16, mass: 0.5 }, durationInFrames: 18 });
  const exit  = interpolate(frame, [clipDuration - 16, clipDuration - 4], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const opacity = Math.min(interpolate(enter, [0, 1], [0, 1]), exit);
  const y = interpolate(enter, [0, 1], [24, 0]);

  const bottomPos = isVertical ? "12%" : 70;
  const sidePos   = isVertical ? "5%" : 50;
  const fontSize  = isVertical ? Math.round(46 * s) : Math.round(38 * s);

  if (style === "bold") {
    return (
      <div style={{ position: "absolute", bottom: bottomPos, left: 0, right: 0, padding: `0 ${sidePos}` }}>
        <div style={{ transform: `translateY(${y}px)`, opacity }}>
          <div style={{ background: accent, padding: `${Math.round(14 * s)}px ${Math.round(32 * s)}px`, display: "inline-block" }}>
            <span style={{ fontSize, fontWeight: 900, color: "#fff", fontFamily: "sans-serif", textTransform: "uppercase", letterSpacing: 2 }}>
              {text}
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (style === "minimal") {
    return (
      <div style={{ position: "absolute", bottom: bottomPos, left: sidePos, right: sidePos, transform: `translateY(${y}px)`, opacity }}>
        <div style={{ width: Math.round(48 * s), height: 3, background: accent, marginBottom: Math.round(12 * s), boxShadow: `0 0 12px ${accent}` }} />
        <span style={{ fontSize, fontWeight: 700, color: "#fff", fontFamily: "sans-serif", lineHeight: 1.3 }}>{text}</span>
      </div>
    );
  }

  // cinematic / modern
  return (
    <div style={{ position: "absolute", bottom: bottomPos, left: sidePos, right: sidePos, transform: `translateY(${y}px)`, opacity }}>
      <div style={{
        background: "rgba(0,0,0,0.72)", backdropFilter: "blur(16px)",
        borderLeft: `${Math.round(5 * s)}px solid ${accent}`,
        borderRadius: "0 14px 14px 0", padding: `${Math.round(14 * s)}px ${Math.round(24 * s)}px`,
        display: "inline-flex", alignItems: "center", gap: Math.round(10 * s),
        boxShadow: `0 8px 40px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.06)`,
        maxWidth: "90%",
      }}>
        <div style={{ width: Math.round(8 * s), height: Math.round(8 * s), borderRadius: "50%", background: accent, boxShadow: `0 0 10px ${accent}`, flexShrink: 0 }} />
        <span style={{ fontSize, fontWeight: 700, color: "#fff", fontFamily: "sans-serif", lineHeight: 1.3 }}>{text}</span>
      </div>
    </div>
  );
};

// ─── Intro screen ─────────────────────────────────────────────────────────────
const IntroScreen: React.FC<{
  title: string; subtitle: string; accent: string; secondary: string; isVertical: boolean;
}> = ({ title, subtitle, accent, secondary, isVertical }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = useScale();
  const INTRO = 50;

  const scaleIn = spring({ fps, frame, config: { damping: 11, mass: 0.7 }, durationInFrames: 28 });
  const fadeOut = interpolate(frame, [INTRO - 14, INTRO], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const subtitleOpacity = interpolate(frame, [16, 32], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  if (frame >= INTRO) return null;

  return (
    <AbsoluteFill style={{
      background: `linear-gradient(160deg, #06020f 0%, #0d0820 60%, #0a0520 100%)`,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      opacity: fadeOut,
    }}>
      <div style={{ position: "absolute", top: -100, right: -80, width: 400, height: 400, borderRadius: "50%", background: `radial-gradient(${accent}40, transparent 70%)`, filter: "blur(60px)" }} />
      <div style={{ position: "absolute", bottom: -80, left: -60, width: 320, height: 320, borderRadius: "50%", background: `radial-gradient(${secondary}30, transparent 70%)`, filter: "blur(50px)" }} />

      <div style={{ transform: `scale(${scaleIn})`, textAlign: "center", padding: isVertical ? "0 60px" : "0 120px", zIndex: 1, maxWidth: "90%" }}>
        <div style={{ width: Math.round(60 * s), height: 4, background: `linear-gradient(90deg, ${accent}, ${secondary})`, borderRadius: 2, margin: `0 auto ${Math.round(28 * s)}px`, boxShadow: `0 0 20px ${accent}` }} />
        <h1 style={{
          fontSize: isVertical ? Math.round(72 * s) : Math.round(80 * s),
          fontWeight: 900, lineHeight: 1.1, fontFamily: "sans-serif",
          background: `linear-gradient(135deg, #fff 0%, rgba(255,255,255,0.75) 100%)`,
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          marginBottom: Math.round(20 * s),
        }}>
          {title}
        </h1>
        {subtitle && (
          <p style={{ fontSize: isVertical ? Math.round(28 * s) : Math.round(30 * s), color: "rgba(255,255,255,0.6)", fontFamily: "sans-serif", opacity: subtitleOpacity }}>
            {subtitle}
          </p>
        )}
      </div>
    </AbsoluteFill>
  );
};

// ─── Brand badge ──────────────────────────────────────────────────────────────
const BrandBadge: React.FC<{ name: string; accent: string; isVertical: boolean }> = ({ name, accent, isVertical }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = useScale();
  const p = spring({ fps, frame, config: { damping: 16 }, durationInFrames: 20 });
  const top = isVertical ? "5%" : 24;

  return (
    <div style={{
      position: "absolute", top, left: Math.round(24 * s),
      display: "flex", alignItems: "center", gap: 8,
      opacity: interpolate(p, [0, 1], [0, 1]),
      transform: `translateY(${interpolate(p, [0, 1], [-12, 0])}px)`,
    }}>
      <div style={{
        background: `linear-gradient(135deg, ${accent}, #7c3aed)`,
        borderRadius: Math.round(10 * s), padding: `${Math.round(6 * s)}px ${Math.round(14 * s)}px`,
        display: "flex", alignItems: "center", gap: Math.round(7 * s),
        boxShadow: `0 4px 20px ${accent}55`,
      }}>
        <svg width={Math.round(16 * s)} height={Math.round(16 * s)} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/>
        </svg>
        <span style={{ fontSize: Math.round(17 * s), fontWeight: 800, color: "#fff", fontFamily: "sans-serif", letterSpacing: 0.5 }}>
          {name}
        </span>
      </div>
    </div>
  );
};

// ─── Progress bar ─────────────────────────────────────────────────────────────
const ProgressBar: React.FC<{ accent: string; totalFrames: number }> = ({ accent, totalFrames }) => {
  const frame = useCurrentFrame();
  const progress = frame / totalFrames;
  return (
    <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 4, background: "rgba(255,255,255,0.08)" }}>
      <div style={{ height: "100%", width: `${progress * 100}%`, background: `linear-gradient(90deg, ${accent}, ${accent}88)`, boxShadow: `0 0 8px ${accent}` }} />
    </div>
  );
};

// ─── Vertical gradient overlay (for reels) ────────────────────────────────────
const VerticalGradient: React.FC = () => (
  <>
    <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "25%", background: "linear-gradient(to bottom, rgba(0,0,0,0.5), transparent)" }} />
    <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "35%", background: "linear-gradient(to top, rgba(0,0,0,0.75), transparent)" }} />
  </>
);

// ─── Main composition ─────────────────────────────────────────────────────────
export const PromoVideo: React.FC<PromoVideoProps> = ({
  clips, voiceUrl, musicUrl, musicVolume = 0.15,
  title, subtitle = "", brandName, accentColor, secondaryColor = "#ff6b6b",
  style = "cinematic",
}) => {
  const { durationInFrames, width, height } = useVideoConfig();
  const isVertical = height > width;
  const INTRO = 50;
  let offset = INTRO;

  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {musicUrl && <Audio src={musicUrl} volume={musicVolume} loop />}
      {voiceUrl  && <Audio src={voiceUrl} startFrom={INTRO} volume={1} />}

      <AbsoluteFill style={{ background: "#05050a" }} />

      {clips.map((clip, i) => {
        const from = offset;
        offset += clip.durationInFrames;
        return (
          <Sequence key={i} from={from} durationInFrames={clip.durationInFrames}>
            <MediaClip clip={clip} />
            {isVertical && <VerticalGradient />}
            <CinemaCaption
              text={clip.caption}
              accent={accentColor}
              secondary={secondaryColor}
              clipDuration={clip.durationInFrames}
              style={style}
              isVertical={isVertical}
            />
          </Sequence>
        );
      })}

      <IntroScreen title={title} subtitle={subtitle} accent={accentColor} secondary={secondaryColor} isVertical={isVertical} />
      <BrandBadge name={brandName} accent={accentColor} isVertical={isVertical} />
      <ProgressBar accent={accentColor} totalFrames={durationInFrames} />
    </AbsoluteFill>
  );
};
