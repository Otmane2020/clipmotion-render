import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { AnimatedChar } from "./AnimatedChar";
import { FeaturePill } from "./FeaturePill";
import { Particles } from "./Particles";

export interface InstaReelProps {
  brand: string;
  headline: string;
  subline: string;
  ctaText: string;
  accentColor: string;
  gradientFrom: string;
  gradientTo: string;
  features: Array<{ icon: string; label: string }>;
}

export const InstaReelDefaultProps: InstaReelProps = {
  brand: "clipmotion.ai",
  headline: "Create Videos\nThat Convert",
  subline: "AI-powered video creation for brands & creators",
  ctaText: "Start Free Today →",
  accentColor: "#ff6b6b",
  gradientFrom: "#1a0533",
  gradientTo: "#0f2b6b",
  features: [
    { icon: "⚡", label: "10x Faster" },
    { icon: "🎨", label: "Auto Branded" },
    { icon: "📱", label: "Multi-Format" },
  ],
};

// ─── Background gradient animé ───────────────────────────────────────────────
const Background: React.FC<{ from: string; to: string; accent: string }> = ({
  from,
  to,
  accent,
}) => {
  const frame = useCurrentFrame();
  const shift = Math.sin(frame * 0.012) * 15;
  const shift2 = Math.cos(frame * 0.008) * 20;

  return (
    <AbsoluteFill>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(${155 + shift}deg, ${from} 0%, #2d1b69 40%, ${to} 100%)`,
        }}
      />
      {/* Orbe accent en haut */}
      <div
        style={{
          position: "absolute",
          top: -120 + shift2,
          right: -80,
          width: 500,
          height: 500,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${accent}55 0%, transparent 70%)`,
          filter: "blur(40px)",
        }}
      />
      {/* Orbe secondaire en bas */}
      <div
        style={{
          position: "absolute",
          bottom: -100,
          left: -60,
          width: 420,
          height: 420,
          borderRadius: "50%",
          background: `radial-gradient(circle, #7c3aed55 0%, transparent 70%)`,
          filter: "blur(50px)",
        }}
      />
    </AbsoluteFill>
  );
};

// ─── Logo / Brand tag ─────────────────────────────────────────────────────────
const BrandTag: React.FC<{ brand: string; accent: string }> = ({ brand, accent }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({ fps, frame, config: { damping: 14, mass: 0.7 }, durationInFrames: 25 });
  const opacity = interpolate(progress, [0, 1], [0, 1]);
  const y = interpolate(progress, [0, 1], [-20, 0]);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        opacity,
        transform: `translateY(${y}px)`,
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          background: `linear-gradient(135deg, ${accent}, #7c3aed)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 18,
          boxShadow: `0 4px 16px ${accent}66`,
        }}
      >
        🎬
      </div>
      <span
        style={{
          fontSize: 24,
          fontWeight: 700,
          color: "rgba(255,255,255,0.9)",
          fontFamily: "sans-serif",
          letterSpacing: 1,
        }}
      >
        {brand}
      </span>
    </div>
  );
};

// ─── Titre avec chaque caractère animé ───────────────────────────────────────
const AnimatedHeadline: React.FC<{
  text: string;
  startFrame: number;
  accent: string;
}> = ({ text, startFrame, accent }) => {
  const lines = text.split("\n");
  let globalIndex = 0;

  return (
    <div style={{ textAlign: "center" }}>
      {lines.map((line, li) => {
        const chars = line.split("");
        return (
          <div
            key={li}
            style={{
              display: "block",
              fontSize: 88,
              fontWeight: 900,
              lineHeight: 1.1,
              fontFamily: "sans-serif",
              overflow: "hidden",
              marginBottom: li < lines.length - 1 ? 8 : 0,
            }}
          >
            {chars.map((ch, ci) => {
              const idx = globalIndex++;
              // Dernière ligne en couleur accent
              const color = li === lines.length - 1 ? accent : "#ffffff";
              return (
                <AnimatedChar
                  key={`${li}-${ci}`}
                  char={ch}
                  delay={startFrame + idx * 2}
                  color={color}
                />
              );
            })}
          </div>
        );
      })}
    </div>
  );
};

// ─── Carte image / mockup ─────────────────────────────────────────────────────
const MockupCard: React.FC<{ accent: string; startFrame: number }> = ({
  accent,
  startFrame,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({
    fps,
    frame: Math.max(0, frame - startFrame),
    config: { damping: 16, mass: 0.8, stiffness: 120 },
    durationInFrames: 30,
  });

  const scale = interpolate(progress, [0, 1], [0.6, 1]);
  const opacity = interpolate(progress, [0, 0.4, 1], [0, 0.9, 1]);
  const float = Math.sin(frame * 0.04) * 8;

  // Barre de stat interne
  const barProgress = interpolate(
    frame,
    [startFrame + 30, startFrame + 70],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  return (
    <div
      style={{
        transform: `scale(${scale}) translateY(${float}px)`,
        opacity,
        width: 520,
        background: "rgba(255,255,255,0.08)",
        backdropFilter: "blur(20px)",
        borderRadius: 28,
        border: "1.5px solid rgba(255,255,255,0.15)",
        padding: 32,
        boxShadow: `0 32px 80px rgba(0,0,0,0.4), 0 0 60px ${accent}22`,
      }}
    >
      {/* Header de la carte */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 24 }}>
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: 14,
            background: `linear-gradient(135deg, ${accent}, #7c3aed)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 26,
          }}
        >
          📈
        </div>
        <div>
          <div
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: "#fff",
              fontFamily: "sans-serif",
            }}
          >
            Video Performance
          </div>
          <div style={{ fontSize: 16, color: "rgba(255,255,255,0.5)", fontFamily: "sans-serif" }}>
            Last 30 days
          </div>
        </div>
      </div>

      {/* Stats */}
      {[
        { label: "Views", value: "2.4M", pct: 0.88, color: accent },
        { label: "Engagement", value: "18.3%", pct: 0.65, color: "#a78bfa" },
        { label: "Conversions", value: "4.2K", pct: 0.42, color: "#34d399" },
      ].map((stat, i) => (
        <div key={i} style={{ marginBottom: 20 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: 8,
            }}
          >
            <span style={{ fontSize: 18, color: "rgba(255,255,255,0.7)", fontFamily: "sans-serif" }}>
              {stat.label}
            </span>
            <span style={{ fontSize: 18, fontWeight: 700, color: "#fff", fontFamily: "sans-serif" }}>
              {stat.value}
            </span>
          </div>
          <div
            style={{
              height: 6,
              background: "rgba(255,255,255,0.1)",
              borderRadius: 3,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${barProgress * stat.pct * 100}%`,
                background: `linear-gradient(90deg, ${stat.color}, ${stat.color}88)`,
                borderRadius: 3,
                transition: "width 0.1s",
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
};

// ─── CTA Badge pulsé ─────────────────────────────────────────────────────────
const CTABadge: React.FC<{ text: string; accent: string; startFrame: number }> = ({
  text,
  accent,
  startFrame,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({
    fps,
    frame: Math.max(0, frame - startFrame),
    config: { damping: 10, mass: 0.5 },
    durationInFrames: 20,
  });

  const scale = interpolate(progress, [0, 1], [0.5, 1]);
  const opacity = interpolate(progress, [0, 1], [0, 1]);
  // Pulse
  const pulse = 1 + Math.sin(frame * 0.12) * 0.025;

  return (
    <div
      style={{
        transform: `scale(${scale * pulse})`,
        opacity,
        background: `linear-gradient(135deg, ${accent}, #7c3aed)`,
        borderRadius: 60,
        padding: "22px 52px",
        boxShadow: `0 8px 40px ${accent}66, 0 0 0 ${8 * (1 - progress)}px ${accent}33`,
      }}
    >
      <span
        style={{
          fontSize: 34,
          fontWeight: 800,
          color: "#fff",
          fontFamily: "sans-serif",
          letterSpacing: 0.5,
        }}
      >
        {text}
      </span>
    </div>
  );
};

// ─── Composition principale ───────────────────────────────────────────────────
export const InstaReel: React.FC<InstaReelProps> = ({
  brand,
  headline,
  subline,
  ctaText,
  accentColor,
  gradientFrom,
  gradientTo,
  features,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Subline
  const sublineOpacity = interpolate(frame, [38, 58], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const sublineY = interpolate(frame, [38, 58], [20, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Divider
  const dividerProgress = spring({
    fps,
    frame: Math.max(0, frame - 45),
    config: { damping: 20, mass: 0.5 },
    durationInFrames: 25,
  });

  return (
    <AbsoluteFill style={{ fontFamily: "sans-serif" }}>
      {/* BG */}
      <Background from={gradientFrom} to={gradientTo} accent={accentColor} />
      <Particles />

      {/* Contenu principal */}
      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "80px 60px",
        }}
      >
        {/* TOP — brand tag */}
        <BrandTag brand={brand} accent={accentColor} />

        {/* CENTRE — headline + subline */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 32 }}>
          <AnimatedHeadline text={headline} startFrame={8} accent={accentColor} />

          {/* Divider */}
          <div
            style={{
              width: `${dividerProgress * 120}px`,
              height: 3,
              background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)`,
              borderRadius: 2,
            }}
          />

          {/* Subline */}
          <p
            style={{
              fontSize: 34,
              color: "rgba(255,255,255,0.72)",
              textAlign: "center",
              maxWidth: 700,
              lineHeight: 1.45,
              margin: 0,
              opacity: sublineOpacity,
              transform: `translateY(${sublineY}px)`,
            }}
          >
            {subline}
          </p>

          {/* Mockup card */}
          <MockupCard accent={accentColor} startFrame={55} />
        </div>

        {/* BAS — feature pills + CTA */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 28 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16, width: "100%" }}>
            {features.map((f, i) => (
              <FeaturePill
                key={i}
                icon={f.icon}
                label={f.label}
                delay={120 + i * 12}
                accent={accentColor}
              />
            ))}
          </div>
          <CTABadge text={ctaText} accent={accentColor} startFrame={150} />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
