import React, { useMemo } from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

export interface QuoteReelProps {
  quote: string;
  author: string;
  role: string;
  accentColor: string;
  highlightWords: string[];
  bgColor: string;
}

export const QuoteReelDefaultProps: QuoteReelProps = {
  quote: "Stop waiting for the perfect moment. Take the moment and make it perfect.",
  author: "Alex Hormozi",
  role: "Entrepreneur & Investor",
  accentColor: "#ff6b35",
  highlightWords: ["perfect", "make"],
  bgColor: "#0a0a0a",
};

// ─── Mot animé ───────────────────────────────────────────────────────────────
const Word: React.FC<{
  word: string;
  globalIndex: number;
  totalWords: number;
  accent: string;
  highlight: boolean;
}> = ({ word, globalIndex, totalWords, accent, highlight }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const stagger = Math.floor(globalIndex * (durationInFrames * 0.45) / totalWords);

  const enter = spring({
    fps,
    frame: Math.max(0, frame - stagger),
    config: { damping: 12, mass: 0.5, stiffness: 200 },
    durationInFrames: 18,
  });

  const y = interpolate(enter, [0, 1], [60, 0]);
  const opacity = interpolate(enter, [0, 0.3, 1], [0, 0.7, 1]);
  const scale = interpolate(enter, [0, 0.6, 1], [0.5, 1.08, 1]);

  return (
    <span
      style={{
        display: "inline-block",
        transform: `translateY(${y}px) scale(${scale})`,
        opacity,
        color: highlight ? accent : "#ffffff",
        marginRight: "0.22em",
        textShadow: highlight ? `0 0 40px ${accent}99, 0 0 80px ${accent}44` : "none",
        fontWeight: highlight ? 900 : 700,
        position: "relative",
      }}
    >
      {highlight && (
        <span
          style={{
            position: "absolute",
            bottom: 4,
            left: 0,
            right: 0,
            height: 4,
            background: accent,
            borderRadius: 2,
            opacity: enter,
            boxShadow: `0 0 12px ${accent}`,
          }}
        />
      )}
      {word}
    </span>
  );
};

// ─── Ligne de séparation animée ───────────────────────────────────────────────
const Divider: React.FC<{ accent: string; startFrame: number }> = ({ accent, startFrame }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const p = spring({ fps, frame: Math.max(0, frame - startFrame), config: { damping: 20 }, durationInFrames: 30 });

  return (
    <div style={{ width: "100%", display: "flex", alignItems: "center", gap: 16, margin: "32px 0" }}>
      <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.15)" }} />
      <div style={{
        width: `${p * 60}px`, height: 3, background: accent,
        borderRadius: 2, boxShadow: `0 0 16px ${accent}`,
      }} />
      <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.15)" }} />
    </div>
  );
};

// ─── Auteur animé ─────────────────────────────────────────────────────────────
const Author: React.FC<{ name: string; role: string; accent: string; startFrame: number }> = ({
  name, role, accent, startFrame,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const p = spring({ fps, frame: Math.max(0, frame - startFrame), config: { damping: 14, mass: 0.6 }, durationInFrames: 25 });
  const opacity = interpolate(p, [0, 1], [0, 1]);
  const y = interpolate(p, [0, 1], [30, 0]);

  return (
    <div style={{ transform: `translateY(${y}px)`, opacity, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      {/* Avatar circle */}
      <div style={{
        width: 72, height: 72, borderRadius: "50%",
        background: `linear-gradient(135deg, ${accent}, #7c3aed)`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 30, marginBottom: 8,
        boxShadow: `0 0 0 3px ${accent}44, 0 0 40px ${accent}33`,
      }}>
        {/* Quote mark icon */}
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
          <path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z" fill="white" opacity="0.9"/>
          <path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z" fill="white" opacity="0.9"/>
        </svg>
      </div>
      <span style={{ fontSize: 28, fontWeight: 800, color: "#fff", fontFamily: "sans-serif", letterSpacing: 1 }}>
        {name}
      </span>
      <span style={{ fontSize: 22, color: "rgba(255,255,255,0.5)", fontFamily: "sans-serif" }}>
        {role}
      </span>
    </div>
  );
};

// ─── Noise overlay (grain cinématique) ───────────────────────────────────────
const Grain: React.FC = () => {
  const frame = useCurrentFrame();
  // SVG noise filter animé frame par frame
  const seed = (frame * 7) % 1000;
  return (
    <AbsoluteFill style={{ opacity: 0.04, pointerEvents: "none" }}>
      <svg width="100%" height="100%" style={{ position: "absolute" }}>
        <filter id="grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" seed={seed} />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#grain)" />
      </svg>
    </AbsoluteFill>
  );
};

// ─── Composition principale ───────────────────────────────────────────────────
export const QuoteReel: React.FC<QuoteReelProps> = ({
  quote, author, role, accentColor, highlightWords, bgColor,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const words = useMemo(() => quote.split(" "), [quote]);
  const highlightSet = useMemo(() => new Set(highlightWords.map((w) => w.toLowerCase())), [highlightWords]);

  // Fade out global fin
  const endFade = interpolate(frame, [durationInFrames - 20, durationInFrames - 5], [1, 0], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });

  // Vignette pulsée
  const vignettePulse = 0.7 + Math.sin(frame * 0.04) * 0.05;

  return (
    <AbsoluteFill style={{ background: bgColor, fontFamily: "sans-serif", opacity: endFade }}>
      <Grain />

      {/* Gradient accent subtil en haut */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 400,
        background: `radial-gradient(ellipse at 50% 0%, ${accentColor}18 0%, transparent 70%)`,
      }} />

      {/* Vignette */}
      <div style={{
        position: "absolute", inset: 0,
        background: `radial-gradient(ellipse at 50% 50%, transparent 40%, rgba(0,0,0,${vignettePulse}) 100%)`,
      }} />

      {/* Contenu centré */}
      <AbsoluteFill style={{
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        padding: "80px 70px",
      }}>
        {/* Guillemet décoratif SVG */}
        <div style={{ opacity: 0.12, marginBottom: -40, alignSelf: "flex-start" }}>
          <svg width="120" height="90" viewBox="0 0 24 18" fill={accentColor}>
            <path d="M0 18V10.5C0 4.7 3.9 1.4 11.7 0l1.05 1.95C9.15 2.85 7.2 4.35 6.75 6.9H10.5V18H0zm13.5 0V10.5C13.5 4.7 17.4 1.4 25.2 0l1.05 1.95c-3.6.9-5.55 2.4-6 4.95H24V18H13.5z"/>
          </svg>
        </div>

        {/* Quote mot par mot */}
        <div style={{
          textAlign: "center",
          fontSize: 72,
          lineHeight: 1.3,
          fontFamily: "sans-serif",
          maxWidth: 900,
          marginBottom: 8,
        }}>
          {words.map((word, i) => {
            const clean = word.toLowerCase().replace(/[^a-z]/g, "");
            return (
              <Word
                key={i}
                word={word}
                globalIndex={i}
                totalWords={words.length}
                accent={accentColor}
                highlight={highlightSet.has(clean)}
              />
            );
          })}
        </div>

        <Divider accent={accentColor} startFrame={Math.floor(words.length * 6)} />

        <Author
          name={author}
          role={role}
          accent={accentColor}
          startFrame={Math.floor(words.length * 7)}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
