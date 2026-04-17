import React, { useMemo } from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

export interface PodcastWord {
  word: string;
  start: number; // frame
  end: number;   // frame
}

export interface PodcastClipProps {
  speakerName: string;
  showName: string;
  topic: string;
  words: PodcastWord[];
  accentColor: string;
  bgColor: string;
  speakerEmoji: string;
}

export const PodcastClipDefaultProps: PodcastClipProps = {
  speakerName: "Sam Altman",
  showName: "The Knowledge Project",
  topic: "On Building the Future",
  accentColor: "#00d4ff",
  bgColor: "#0d0d0d",
  speakerEmoji: "🎙️",
  words: [
    { word: "The", start: 10, end: 20 },
    { word: "best", start: 21, end: 35 },
    { word: "way", start: 36, end: 48 },
    { word: "to", start: 49, end: 57 },
    { word: "predict", start: 58, end: 80 },
    { word: "the", start: 81, end: 90 },
    { word: "future", start: 91, end: 115 },
    { word: "is", start: 116, end: 125 },
    { word: "to", start: 126, end: 135 },
    { word: "build", start: 136, end: 160 },
    { word: "it.", start: 161, end: 185 },
  ],
};

// ─── Waveform simulé audio-réactif ───────────────────────────────────────────
const Waveform: React.FC<{ accent: string; isActive: boolean }> = ({ accent, isActive }) => {
  const frame = useCurrentFrame();
  const BAR_COUNT = 48;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, height: 64 }}>
      {Array.from({ length: BAR_COUNT }, (_, i) => {
        const baseHeight = 6 + Math.sin(i * 0.8) * 4;
        const wave1 = Math.sin((frame * 0.18 + i * 0.5)) * (isActive ? 18 : 4);
        const wave2 = Math.cos((frame * 0.12 + i * 0.3)) * (isActive ? 10 : 2);
        const h = Math.max(4, baseHeight + wave1 + wave2);
        const opacity = isActive ? 0.8 + Math.sin(frame * 0.2 + i) * 0.2 : 0.25;

        return (
          <div
            key={i}
            style={{
              width: 5,
              height: h,
              borderRadius: 3,
              background: isActive
                ? `linear-gradient(180deg, ${accent}, ${accent}88)`
                : "rgba(255,255,255,0.3)",
              opacity,
              transition: "height 0.05s",
            }}
          />
        );
      })}
    </div>
  );
};

// ─── Caption mot par mot style TikTok ────────────────────────────────────────
const CaptionDisplay: React.FC<{ words: PodcastWord[]; accent: string }> = ({ words, accent }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Groupe de 3-4 mots à afficher ensemble
  const WORDS_PER_GROUP = 4;
  const groups: PodcastWord[][] = [];
  for (let i = 0; i < words.length; i += WORDS_PER_GROUP) {
    groups.push(words.slice(i, i + WORDS_PER_GROUP));
  }

  const activeGroup = groups.find((g) => {
    const first = g[0];
    const last = g[g.length - 1];
    return frame >= first.start - 3 && frame <= last.end + 8;
  });

  if (!activeGroup) return null;

  const groupStartFrame = activeGroup[0].start;

  const groupEnter = spring({
    fps,
    frame: Math.max(0, frame - groupStartFrame + 3),
    config: { damping: 16, mass: 0.4 },
    durationInFrames: 12,
  });

  const groupY = interpolate(groupEnter, [0, 1], [20, 0]);
  const groupOpacity = interpolate(groupEnter, [0, 1], [0, 1]);

  return (
    <div style={{
      transform: `translateY(${groupY}px)`,
      opacity: groupOpacity,
      display: "flex",
      flexWrap: "wrap",
      justifyContent: "center",
      gap: 12,
      padding: "0 40px",
    }}>
      {activeGroup.map((w, i) => {
        const isActive = frame >= w.start && frame <= w.end;
        const wasSaid = frame > w.end;

        return (
          <span key={i} style={{
            fontSize: 68,
            fontWeight: 900,
            fontFamily: "sans-serif",
            color: isActive ? "#000" : wasSaid ? "rgba(255,255,255,0.5)" : "#fff",
            background: isActive ? accent : "transparent",
            padding: isActive ? "4px 18px" : "4px 0",
            borderRadius: isActive ? 10 : 0,
            lineHeight: 1.2,
            textTransform: "uppercase",
            letterSpacing: -1,
            transition: "all 0.06s",
            boxShadow: isActive ? `0 4px 24px ${accent}66` : "none",
          }}>
            {w.word}
          </span>
        );
      })}
    </div>
  );
};

// ─── Speaker card ─────────────────────────────────────────────────────────────
const SpeakerCard: React.FC<{
  name: string;
  show: string;
  emoji: string;
  accent: string;
}> = ({ name, show, emoji, accent }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const p = spring({ fps, frame, config: { damping: 14 }, durationInFrames: 20 });
  const opacity = interpolate(p, [0, 1], [0, 1]);
  const x = interpolate(p, [0, 1], [-40, 0]);

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 16,
      transform: `translateX(${x}px)`, opacity,
      background: "rgba(255,255,255,0.06)",
      backdropFilter: "blur(10px)",
      border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: 50, padding: "12px 24px 12px 12px",
    }}>
      <div style={{
        width: 52, height: 52, borderRadius: "50%",
        background: `linear-gradient(135deg, ${accent}88, ${accent}44)`,
        display: "flex", alignItems: "center", justifyContent: "center",
        border: `2px solid ${accent}`,
      }}>
        {/* Mic icon SVG */}
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/>
          <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
          <line x1="12" y1="19" x2="12" y2="22"/>
          <line x1="8" y1="22" x2="16" y2="22"/>
        </svg>
      </div>
      <div>
        <div style={{ fontSize: 22, fontWeight: 800, color: "#fff", fontFamily: "sans-serif" }}>{name}</div>
        <div style={{ fontSize: 16, color: "rgba(255,255,255,0.5)", fontFamily: "sans-serif" }}>{show}</div>
      </div>
      {/* Live indicator */}
      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#ff4444", boxShadow: "0 0 8px #ff4444" }} />
        <span style={{ fontSize: 11, fontWeight: 700, color: "#ff4444", fontFamily: "sans-serif", letterSpacing: 1 }}>LIVE</span>
      </div>
    </div>
  );
};

// ─── Topic badge ──────────────────────────────────────────────────────────────
const TopicBadge: React.FC<{ topic: string; accent: string }> = ({ topic, accent }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const p = spring({ fps, frame: Math.max(0, frame - 5), config: { damping: 14 }, durationInFrames: 20 });
  const opacity = interpolate(p, [0, 1], [0, 1]);
  const y = interpolate(p, [0, 1], [15, 0]);

  return (
    <div style={{
      transform: `translateY(${y}px)`, opacity,
      background: `${accent}22`,
      border: `1px solid ${accent}66`,
      borderRadius: 50, padding: "8px 20px",
      display: "flex", alignItems: "center", gap: 8,
    }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      <span style={{ fontSize: 20, color: accent, fontFamily: "sans-serif", fontWeight: 600 }}>{topic}</span>
    </div>
  );
};

// ─── Composition principale ───────────────────────────────────────────────────
export const PodcastClip: React.FC<PodcastClipProps> = ({
  speakerName, showName, topic, words, accentColor, bgColor, speakerEmoji,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const lastWordEnd = useMemo(() => Math.max(...words.map((w) => w.end)), [words]);
  const isAudioActive = frame >= words[0].start - 5 && frame <= lastWordEnd + 5;

  // Progress bar
  const progress = interpolate(frame, [0, durationInFrames], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ background: bgColor, fontFamily: "sans-serif" }}>
      {/* Gradient de fond */}
      <div style={{
        position: "absolute", inset: 0,
        background: `radial-gradient(ellipse at 50% 100%, ${accentColor}12 0%, transparent 60%)`,
      }} />

      {/* Layout vertical */}
      <AbsoluteFill style={{
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "space-between",
        padding: "70px 50px 60px",
      }}>
        {/* TOP */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
          <SpeakerCard name={speakerName} show={showName} emoji={speakerEmoji} accent={accentColor} />
          <TopicBadge topic={topic} accent={accentColor} />
        </div>

        {/* CENTRE — captions */}
        <div style={{
          flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
          width: "100%",
        }}>
          <CaptionDisplay words={words} accent={accentColor} />
        </div>

        {/* BAS — waveform + progress */}
        <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
          <Waveform accent={accentColor} isActive={isAudioActive} />

          {/* Progress bar */}
          <div style={{ width: "100%", height: 3, background: "rgba(255,255,255,0.1)", borderRadius: 2 }}>
            <div style={{
              height: "100%", width: `${progress * 100}%`,
              background: `linear-gradient(90deg, ${accentColor}, ${accentColor}88)`,
              borderRadius: 2,
              boxShadow: `0 0 8px ${accentColor}`,
            }} />
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
