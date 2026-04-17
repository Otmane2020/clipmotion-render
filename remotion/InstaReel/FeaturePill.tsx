import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

export const FeaturePill: React.FC<{
  icon: string;
  label: string;
  delay: number;
  accent: string;
}> = ({ icon, label, delay, accent }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({
    fps,
    frame: Math.max(0, frame - delay),
    config: { damping: 12, mass: 0.5, stiffness: 160 },
    durationInFrames: 22,
  });

  const x = interpolate(progress, [0, 1], [-80, 0]);
  const opacity = interpolate(progress, [0, 0.5, 1], [0, 0.9, 1]);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        background: "rgba(255,255,255,0.12)",
        backdropFilter: "blur(12px)",
        border: `1.5px solid rgba(255,255,255,0.2)`,
        borderRadius: 50,
        padding: "14px 28px",
        transform: `translateX(${x}px)`,
        opacity,
      }}
    >
      <span style={{ fontSize: 32 }}>{icon}</span>
      <span
        style={{
          fontSize: 26,
          fontWeight: 600,
          color: "#fff",
          fontFamily: "sans-serif",
          letterSpacing: 0.5,
        }}
      >
        {label}
      </span>
      <div
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: accent,
          boxShadow: `0 0 8px ${accent}`,
        }}
      />
    </div>
  );
};
