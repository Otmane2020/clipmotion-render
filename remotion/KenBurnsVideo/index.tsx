import React from "react";
import {
  AbsoluteFill,
  Img,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
  Audio,
  staticFile,
} from "remotion";

export interface KenBurnsScene {
  imageUrl: string;
  caption: string;
  durationInFrames: number;
  panDirection: "left" | "right" | "up" | "down" | "zoom-in" | "zoom-out";
}

export interface KenBurnsVideoProps {
  scenes: KenBurnsScene[];
  title: string;
  brandName: string;
  accentColor: string;
  audioUrl?: string;
}

export const KenBurnsVideoDefaultProps: KenBurnsVideoProps = {
  title: "Discover the Future",
  brandName: "clipmotion.ai",
  accentColor: "#6c47ff",
  scenes: [
    {
      imageUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1080&q=80",
      caption: "AI-powered creativity",
      durationInFrames: 90,
      panDirection: "zoom-in",
    },
    {
      imageUrl: "https://images.unsplash.com/photo-1535223289827-42f1e9919769?w=1080&q=80",
      caption: "Built for creators",
      durationInFrames: 90,
      panDirection: "left",
    },
    {
      imageUrl: "https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?w=1080&q=80",
      caption: "Go viral instantly",
      durationInFrames: 90,
      panDirection: "zoom-out",
    },
  ],
};

// ─── Ken Burns animé sur une image ───────────────────────────────────────────
const KenBurnsScene: React.FC<{
  scene: KenBurnsScene;
  isFirst: boolean;
}> = ({ scene, isFirst }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const dur = scene.durationInFrames;

  // Pan/zoom transform
  const progress = frame / dur;
  let scale = 1;
  let translateX = 0;
  let translateY = 0;

  switch (scene.panDirection) {
    case "zoom-in":
      scale = interpolate(progress, [0, 1], [1, 1.18]);
      break;
    case "zoom-out":
      scale = interpolate(progress, [0, 1], [1.18, 1]);
      break;
    case "left":
      scale = 1.12;
      translateX = interpolate(progress, [0, 1], [0, -6]);
      break;
    case "right":
      scale = 1.12;
      translateX = interpolate(progress, [0, 1], [0, 6]);
      break;
    case "up":
      scale = 1.12;
      translateY = interpolate(progress, [0, 1], [0, -5]);
      break;
    case "down":
      scale = 1.12;
      translateY = interpolate(progress, [0, 1], [0, 5]);
      break;
  }

  // Fade in/out de la scène
  const fadeIn = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [dur - 12, dur], [1, 0], { extrapolateLeft: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);

  return (
    <AbsoluteFill style={{ opacity }}>
      <div style={{ width: "100%", height: "100%", overflow: "hidden" }}>
        <Img
          src={scene.imageUrl}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            transform: `scale(${scale}) translate(${translateX}%, ${translateY}%)`,
            transformOrigin: "center center",
          }}
        />
      </div>
    </AbsoluteFill>
  );
};

// ─── Caption animé ────────────────────────────────────────────────────────────
const Caption: React.FC<{
  text: string;
  accent: string;
  sceneDuration: number;
}> = ({ text, accent, sceneDuration }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enter = spring({ fps, frame: Math.max(0, frame - 8), config: { damping: 14, mass: 0.5 }, durationInFrames: 20 });
  const exit = interpolate(frame, [sceneDuration - 18, sceneDuration - 5], [1, 0], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });

  const y = interpolate(enter, [0, 1], [30, 0]);
  const opacity = Math.min(enter, exit);

  return (
    <div style={{
      position: "absolute",
      bottom: 120,
      left: 40,
      right: 40,
      transform: `translateY(${y}px)`,
      opacity,
    }}>
      <div style={{
        background: "rgba(0,0,0,0.65)",
        backdropFilter: "blur(12px)",
        borderLeft: `4px solid ${accent}`,
        borderRadius: "0 12px 12px 0",
        padding: "16px 24px",
        display: "inline-block",
      }}>
        <span style={{
          fontSize: 36,
          fontWeight: 700,
          color: "#fff",
          fontFamily: "sans-serif",
          letterSpacing: 0.5,
        }}>
          {text}
        </span>
      </div>
    </div>
  );
};

// ─── Brand watermark ──────────────────────────────────────────────────────────
const BrandWatermark: React.FC<{ name: string; accent: string }> = ({ name, accent }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ fps, frame, config: { damping: 14 }, durationInFrames: 20 });
  const opacity = interpolate(p, [0, 1], [0, 0.85]);

  return (
    <div style={{
      position: "absolute", top: 28, left: 28,
      display: "flex", alignItems: "center", gap: 8,
      opacity,
    }}>
      <div style={{
        background: `linear-gradient(135deg, ${accent}, #7c3aed)`,
        borderRadius: 8,
        padding: "6px 14px",
        display: "flex", alignItems: "center", gap: 6,
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/>
        </svg>
        <span style={{ fontSize: 16, fontWeight: 800, color: "#fff", fontFamily: "sans-serif" }}>
          {name}
        </span>
      </div>
    </div>
  );
};

// ─── Titre intro ──────────────────────────────────────────────────────────────
const TitleIntro: React.FC<{ title: string; accent: string }> = ({ title, accent }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const INTRO = 45;

  const scale = spring({ fps, frame, config: { damping: 12, mass: 0.6 }, durationInFrames: 25 });
  const opacity = interpolate(frame, [INTRO - 15, INTRO], [1, 0], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });

  if (frame >= INTRO) return null;

  return (
    <AbsoluteFill style={{
      background: "rgba(0,0,0,0.8)",
      display: "flex", alignItems: "center", justifyContent: "center",
      opacity,
    }}>
      <div style={{
        transform: `scale(${scale})`,
        textAlign: "center", padding: "0 60px",
      }}>
        <div style={{
          width: 3, height: 40,
          background: accent,
          borderRadius: 2,
          margin: "0 auto 20px",
          boxShadow: `0 0 20px ${accent}`,
        }} />
        <h1 style={{
          fontSize: 64,
          fontWeight: 900,
          color: "#fff",
          fontFamily: "sans-serif",
          lineHeight: 1.15,
          background: `linear-gradient(135deg, #fff 0%, ${accent} 100%)`,
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
        }}>
          {title}
        </h1>
      </div>
    </AbsoluteFill>
  );
};

// ─── Progress dots ────────────────────────────────────────────────────────────
const ProgressDots: React.FC<{
  scenes: KenBurnsScene[];
  accent: string;
}> = ({ scenes, accent }) => {
  const frame = useCurrentFrame();
  const INTRO = 45;

  let elapsed = frame - INTRO;
  let activeIndex = 0;
  for (let i = 0; i < scenes.length; i++) {
    if (elapsed < scenes[i].durationInFrames) { activeIndex = i; break; }
    elapsed -= scenes[i].durationInFrames;
    activeIndex = i;
  }

  return (
    <div style={{
      position: "absolute", bottom: 48, left: "50%",
      transform: "translateX(-50%)",
      display: "flex", gap: 8,
    }}>
      {scenes.map((_, i) => (
        <div key={i} style={{
          width: i === activeIndex ? 24 : 8,
          height: 8,
          borderRadius: 4,
          background: i === activeIndex ? accent : "rgba(255,255,255,0.3)",
          transition: "all 0.3s",
          boxShadow: i === activeIndex ? `0 0 10px ${accent}` : "none",
        }} />
      ))}
    </div>
  );
};

// ─── Composition principale ───────────────────────────────────────────────────
export const KenBurnsVideo: React.FC<KenBurnsVideoProps> = ({
  scenes, title, brandName, accentColor, audioUrl,
}) => {
  const INTRO = 45;
  let offset = INTRO;

  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {/* Audio optionnel */}
      {audioUrl && (
        <Audio src={audioUrl} />
      )}

      {/* Fond noir intro */}
      <AbsoluteFill style={{ background: "#05050f" }} />

      {/* Scènes Ken Burns */}
      {scenes.map((scene, i) => {
        const start = offset;
        offset += scene.durationInFrames;
        return (
          <Sequence key={i} from={start} durationInFrames={scene.durationInFrames}>
            <KenBurnsScene scene={scene} isFirst={i === 0} />
            <Caption text={scene.caption} accent={accentColor} sceneDuration={scene.durationInFrames} />
          </Sequence>
        );
      })}

      {/* Titre intro overlay */}
      <TitleIntro title={title} accent={accentColor} />

      {/* Brand watermark permanent */}
      <BrandWatermark name={brandName} accent={accentColor} />

      {/* Progress dots */}
      <ProgressDots scenes={scenes} accent={accentColor} />
    </AbsoluteFill>
  );
};
