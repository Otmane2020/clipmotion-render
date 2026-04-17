import React from "react";
import { interpolate, useCurrentFrame } from "remotion";

const PARTICLES = [
  { x: 8, y: 15, size: 6, speed: 0.4, opacity: 0.25, delay: 0 },
  { x: 88, y: 8, size: 10, speed: 0.3, opacity: 0.2, delay: 10 },
  { x: 20, y: 70, size: 8, speed: 0.5, opacity: 0.18, delay: 5 },
  { x: 75, y: 55, size: 14, speed: 0.25, opacity: 0.22, delay: 15 },
  { x: 50, y: 90, size: 7, speed: 0.45, opacity: 0.3, delay: 3 },
  { x: 35, y: 30, size: 12, speed: 0.35, opacity: 0.15, delay: 8 },
  { x: 92, y: 80, size: 9, speed: 0.4, opacity: 0.2, delay: 12 },
  { x: 60, y: 20, size: 5, speed: 0.55, opacity: 0.28, delay: 6 },
  { x: 15, y: 45, size: 11, speed: 0.3, opacity: 0.17, delay: 20 },
  { x: 80, y: 35, size: 6, speed: 0.5, opacity: 0.23, delay: 2 },
];

export const Particles: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
      {PARTICLES.map((p, i) => {
        const floatY = Math.sin((frame + p.delay * 10) * p.speed * 0.05) * 18;
        const floatX = Math.cos((frame + p.delay * 7) * p.speed * 0.03) * 8;
        const entryProgress = interpolate(frame, [p.delay, p.delay + 25], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${p.x}%`,
              top: `${p.y}%`,
              width: p.size * 2,
              height: p.size * 2,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.9)",
              opacity: p.opacity * entryProgress,
              transform: `translate(${floatX}px, ${floatY}px)`,
              filter: "blur(1px)",
            }}
          />
        );
      })}
    </div>
  );
};
