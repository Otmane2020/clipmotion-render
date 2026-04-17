import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

// ─── SVG Icons pro ────────────────────────────────────────────────────────────
const ICONS: Record<string, React.FC<{ size?: number; color?: string }>> = {
  video: ({ size = 20, color = "white" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/>
    </svg>
  ),
  trending: ({ size = 20, color = "white" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>
    </svg>
  ),
  zap: ({ size = 20, color = "white" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
    </svg>
  ),
  bot: ({ size = 20, color = "white" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><line x1="8" y1="16" x2="8" y2="16"/><line x1="16" y1="16" x2="16" y2="16"/>
    </svg>
  ),
  palette: ({ size = 20, color = "white" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="13.5" cy="6.5" r=".5" fill={color}/><circle cx="17.5" cy="10.5" r=".5" fill={color}/><circle cx="8.5" cy="7.5" r=".5" fill={color}/><circle cx="6.5" cy="12.5" r=".5" fill={color}/>
      <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>
    </svg>
  ),
  globe: ({ size = 20, color = "white" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
    </svg>
  ),
  smartphone: ({ size = 20, color = "white" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/>
    </svg>
  ),
};

const Icon: React.FC<{ name: string; size?: number; color?: string }> = ({ name, size = 20, color = "white" }) => {
  const Comp = ICONS[name] ?? ICONS.video;
  return <Comp size={size} color={color} />;
};

export interface SaaSPromoProps {
  appName: string;
  tagline: string;
  cta: string;
  accentColor: string;
  secondaryColor: string;
  stats: Array<{ label: string; value: string; icon: string }>;
  features: Array<{ icon: string; text: string }>;
}

export const SaaSPromoDefaultProps: SaaSPromoProps = {
  appName: "clipmotion.ai",
  tagline: "Create viral videos in 60 seconds",
  cta: "Start Free — No Card Needed",
  accentColor: "#6c47ff",
  secondaryColor: "#ff6b6b",
  stats: [
    { label: "Videos Created", value: "2.4M+", icon: "video" },
    { label: "Avg. Engagement", value: "+340%", icon: "trending" },
    { label: "Time Saved", value: "10x", icon: "zap" },
  ],
  features: [
    { icon: "bot", text: "AI Script Generation" },
    { icon: "palette", text: "Auto Brand Design" },
    { icon: "globe", text: "40+ Languages" },
    { icon: "smartphone", text: "All Formats" },
  ],
};

// ─── Phone mockup CSS 3D ──────────────────────────────────────────────────────
const PhoneMockup: React.FC<{ accent: string; secondary: string }> = ({ accent, secondary }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enter = spring({ fps, frame: Math.max(0, frame - 20), config: { damping: 14, mass: 0.8 }, durationInFrames: 35 });
  const rotateY = interpolate(frame, [0, 300], [-8, 8]);
  const rotateX = 8 + Math.sin(frame * 0.025) * 3;
  const floatY = Math.sin(frame * 0.04) * 10;

  const scale = interpolate(enter, [0, 1], [0.3, 1]);
  const opacity = interpolate(enter, [0, 0.5, 1], [0, 0.8, 1]);

  return (
    <div style={{
      transform: `scale(${scale}) translateY(${floatY}px) perspective(1200px) rotateY(${rotateY}deg) rotateX(${rotateX}deg)`,
      opacity,
      transformStyle: "preserve-3d",
    }}>
      {/* Corps du téléphone */}
      <div style={{
        width: 260,
        height: 520,
        borderRadius: 44,
        background: "linear-gradient(145deg, #1a1a2e, #16213e)",
        border: "2px solid rgba(255,255,255,0.12)",
        boxShadow: `
          0 60px 120px rgba(0,0,0,0.6),
          0 0 0 1px rgba(255,255,255,0.05),
          inset 0 1px 0 rgba(255,255,255,0.1),
          20px 20px 60px rgba(0,0,0,0.4),
          -5px -5px 20px rgba(255,255,255,0.03),
          0 0 80px ${accent}22
        `,
        position: "relative",
        overflow: "hidden",
      }}>
        {/* Notch */}
        <div style={{
          position: "absolute", top: 16, left: "50%",
          transform: "translateX(-50%)",
          width: 90, height: 28,
          background: "#0d0d0d",
          borderRadius: 14,
          zIndex: 10,
        }} />

        {/* Screen content */}
        <div style={{
          position: "absolute", inset: 0,
          background: `linear-gradient(160deg, ${accent}22 0%, #0d0d1a 50%, ${secondary}11 100%)`,
          display: "flex", flexDirection: "column",
          padding: "60px 20px 20px",
          gap: 12,
        }}>
          {/* App header */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 8,
              background: `linear-gradient(135deg, ${accent}, ${secondary})`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>
            </div>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#fff", fontFamily: "sans-serif" }}>clipmotion</span>
          </div>

          {/* Fake video thumbnail */}
          <div style={{
            width: "100%", height: 130,
            borderRadius: 14,
            background: `linear-gradient(135deg, ${accent}44, ${secondary}33)`,
            display: "flex", alignItems: "center", justifyContent: "center",
            border: `1px solid ${accent}33`,
            position: "relative",
            overflow: "hidden",
          }}>
            <div style={{
              position: "absolute", inset: 0,
              background: `repeating-linear-gradient(45deg, transparent, transparent 10px, ${accent}08 10px, ${accent}08 11px)`,
            }} />
            <div style={{
              width: 44, height: 44, borderRadius: "50%",
              background: "rgba(255,255,255,0.15)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 20, backdropFilter: "blur(4px)",
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="rgba(255,255,255,0.9)"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            </div>
          </div>

          {/* Fake stats bars */}
          {[0.88, 0.62, 0.45].map((v, i) => {
            const barW = interpolate(frame, [50 + i * 15, 90 + i * 15], [0, v * 100], {
              extrapolateLeft: "clamp", extrapolateRight: "clamp",
            });
            const colors = [accent, secondary, "#34d399"];
            return (
              <div key={i} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ height: 5, background: "rgba(255,255,255,0.06)", borderRadius: 3 }}>
                  <div style={{
                    height: "100%", width: `${barW}%`,
                    background: colors[i], borderRadius: 3,
                    boxShadow: `0 0 6px ${colors[i]}`,
                  }} />
                </div>
              </div>
            );
          })}

          {/* Fake buttons */}
          <div style={{
            marginTop: "auto",
            background: `linear-gradient(135deg, ${accent}, ${secondary})`,
            borderRadius: 12, padding: "10px",
            textAlign: "center", fontSize: 12,
            color: "#fff", fontWeight: 700, fontFamily: "sans-serif",
          }}>
            Generate Video →
          </div>
        </div>

        {/* Screen glare */}
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: "40%",
          background: "linear-gradient(180deg, rgba(255,255,255,0.04) 0%, transparent 100%)",
          borderRadius: "44px 44px 0 0",
        }} />
      </div>
    </div>
  );
};

// ─── Stat counter animé ───────────────────────────────────────────────────────
const StatCard: React.FC<{
  stat: { label: string; value: string; icon: string };
  delay: number;
  accent: string;
}> = ({ stat, delay, accent }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const p = spring({ fps, frame: Math.max(0, frame - delay), config: { damping: 12, mass: 0.5 }, durationInFrames: 22 });
  const scale = interpolate(p, [0, 0.6, 1], [0.3, 1.1, 1]);
  const opacity = interpolate(p, [0, 1], [0, 1]);

  return (
    <div style={{
      transform: `scale(${scale})`, opacity,
      background: "rgba(255,255,255,0.06)",
      backdropFilter: "blur(12px)",
      border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: 20, padding: "20px 24px",
      display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
      minWidth: 160,
      boxShadow: `0 8px 32px rgba(0,0,0,0.3), 0 0 0 1px ${accent}22`,
    }}>
      <Icon name={stat.icon} size={28} color={accent} />
      <span style={{
        fontSize: 38, fontWeight: 900, color: "#fff",
        fontFamily: "sans-serif", letterSpacing: -1,
        background: `linear-gradient(135deg, #fff, ${accent})`,
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
      }}>
        {stat.value}
      </span>
      <span style={{ fontSize: 16, color: "rgba(255,255,255,0.5)", fontFamily: "sans-serif", textAlign: "center" }}>
        {stat.label}
      </span>
    </div>
  );
};

// ─── Feature chip ─────────────────────────────────────────────────────────────
const FeatureChip: React.FC<{ icon: string; text: string; delay: number; accent: string }> = ({
  icon, text, delay, accent,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const p = spring({ fps, frame: Math.max(0, frame - delay), config: { damping: 14, mass: 0.4 }, durationInFrames: 18 });
  const x = interpolate(p, [0, 1], [50, 0]);
  const opacity = interpolate(p, [0, 1], [0, 1]);

  return (
    <div style={{
      transform: `translateX(${x}px)`, opacity,
      display: "flex", alignItems: "center", gap: 10,
      background: `${accent}15`,
      border: `1px solid ${accent}33`,
      borderRadius: 50, padding: "10px 20px",
    }}>
      <Icon name={icon} size={18} color={accent} />
      <span style={{ fontSize: 20, fontWeight: 600, color: "rgba(255,255,255,0.85)", fontFamily: "sans-serif" }}>
        {text}
      </span>
    </div>
  );
};

// ─── CTA pulsé ────────────────────────────────────────────────────────────────
const CTA: React.FC<{ text: string; accent: string; secondary: string; startFrame: number }> = ({
  text, accent, secondary, startFrame,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const p = spring({ fps, frame: Math.max(0, frame - startFrame), config: { damping: 10 }, durationInFrames: 22 });
  const scale = interpolate(p, [0, 1], [0, 1]);
  const opacity = interpolate(p, [0, 1], [0, 1]);
  const pulse = 1 + Math.sin(frame * 0.15) * 0.02;
  const glow = 0.5 + Math.sin(frame * 0.15) * 0.3;

  return (
    <div style={{
      transform: `scale(${scale * pulse})`, opacity,
      background: `linear-gradient(135deg, ${accent}, ${secondary})`,
      borderRadius: 60, padding: "20px 48px",
      boxShadow: `0 8px 40px ${accent}${Math.round(glow * 99).toString(16).padStart(2, "0")}, 0 0 0 1px rgba(255,255,255,0.1)`,
      cursor: "pointer",
    }}>
      <span style={{
        fontSize: 28, fontWeight: 800, color: "#fff",
        fontFamily: "sans-serif", letterSpacing: 0.3,
      }}>
        {text}
      </span>
    </div>
  );
};

// ─── Composition principale ───────────────────────────────────────────────────
export const SaaSPromo: React.FC<SaaSPromoProps> = ({
  appName, tagline, cta, accentColor, secondaryColor, stats, features,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Headline
  const headlineP = spring({ fps, frame, config: { damping: 14, mass: 0.6 }, durationInFrames: 25 });
  const headlineY = interpolate(headlineP, [0, 1], [-40, 0]);
  const headlineOpacity = interpolate(headlineP, [0, 1], [0, 1]);

  // Tagline
  const taglineP = interpolate(frame, [15, 38], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const taglineY = interpolate(taglineP, [0, 1], [20, 0]);

  return (
    <AbsoluteFill style={{
      background: "linear-gradient(160deg, #050510 0%, #0d0d1e 50%, #0a0520 100%)",
      fontFamily: "sans-serif",
    }}>
      {/* Orbes background */}
      <div style={{
        position: "absolute", top: -150, right: -100,
        width: 500, height: 500, borderRadius: "50%",
        background: `radial-gradient(circle, ${accentColor}30 0%, transparent 70%)`,
        filter: "blur(60px)",
      }} />
      <div style={{
        position: "absolute", bottom: -100, left: -80,
        width: 400, height: 400, borderRadius: "50%",
        background: `radial-gradient(circle, ${secondaryColor}25 0%, transparent 70%)`,
        filter: "blur(50px)",
      }} />

      {/* Layout split : gauche texte / droite phone */}
      <AbsoluteFill style={{
        display: "flex", flexDirection: "row",
        alignItems: "center", justifyContent: "center",
        padding: "60px 70px",
        gap: 60,
      }}>
        {/* GAUCHE */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 28 }}>
          {/* Brand */}
          <div style={{
            display: "flex", alignItems: "center", gap: 12,
            transform: `translateY(${headlineY}px)`, opacity: headlineOpacity,
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: `linear-gradient(135deg, ${accentColor}, ${secondaryColor})`,
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: `0 4px 20px ${accentColor}66`,
            }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>
            </div>
            <span style={{ fontSize: 26, fontWeight: 800, color: "#fff", letterSpacing: 1 }}>
              {appName}
            </span>
          </div>

          {/* Tagline */}
          <div style={{
            fontSize: 52, fontWeight: 900, lineHeight: 1.15,
            transform: `translateY(${headlineY}px)`, opacity: headlineOpacity,
          }}>
            <span style={{
              background: `linear-gradient(135deg, #fff 0%, rgba(255,255,255,0.7) 100%)`,
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            }}>
              {tagline.split(" ").slice(0, 3).join(" ")}
            </span>
            {" "}
            <span style={{
              background: `linear-gradient(135deg, ${accentColor}, ${secondaryColor})`,
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            }}>
              {tagline.split(" ").slice(3).join(" ")}
            </span>
          </div>

          {/* Stats */}
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            {stats.map((s, i) => (
              <StatCard key={i} stat={s} delay={30 + i * 12} accent={accentColor} />
            ))}
          </div>

          {/* Features */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {features.map((f, i) => (
              <FeatureChip key={i} icon={f.icon} text={f.text} delay={70 + i * 10} accent={accentColor} />
            ))}
          </div>

          {/* CTA */}
          <CTA text={cta} accent={accentColor} secondary={secondaryColor} startFrame={110} />
        </div>

        {/* DROITE — phone */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          <PhoneMockup accent={accentColor} secondary={secondaryColor} />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
