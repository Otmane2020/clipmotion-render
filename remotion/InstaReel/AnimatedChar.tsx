import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

export const AnimatedChar: React.FC<{
  char: string;
  delay: number;
  color?: string;
}> = ({ char, delay, color = "#ffffff" }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({
    fps,
    frame: Math.max(0, frame - delay),
    config: { damping: 14, mass: 0.6, stiffness: 180 },
    durationInFrames: 20,
  });

  const y = interpolate(progress, [0, 1], [40, 0]);
  const opacity = interpolate(progress, [0, 0.4, 1], [0, 0.8, 1]);

  if (char === " ") return <span style={{ display: "inline-block", width: "0.35em" }} />;

  return (
    <span
      style={{
        display: "inline-block",
        transform: `translateY(${y}px)`,
        opacity,
        color,
      }}
    >
      {char}
    </span>
  );
};
