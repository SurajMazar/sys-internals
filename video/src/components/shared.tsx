import React from "react";
import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { theme } from "../theme";

/** Fade + slide up, spring-eased, starting `delayFrames` after the scene begins. */
export const fadeSlideIn = (
  frame: number,
  delayFrames: number,
  fps: number,
  distance = 24
): React.CSSProperties => {
  const local = frame - delayFrames;
  if (local < 0) return { opacity: 0, transform: `translateY(${distance}px)` };
  const p = spring({ frame: local, fps, config: { damping: 200, stiffness: 120, mass: 0.7 } });
  return { opacity: Math.min(1, p), transform: `translateY(${(1 - p) * distance}px)` };
};

/** Spring pop-in scale, for cards/badges/checkmarks. */
export const popIn = (frame: number, delayFrames: number, fps: number): React.CSSProperties => {
  const local = frame - delayFrames;
  if (local < 0) return { opacity: 0, transform: "scale(0.6)" };
  const p = spring({ frame: local, fps, config: { damping: 12, stiffness: 200, mass: 0.5 } });
  return { opacity: Math.min(1, p), transform: `scale(${p})` };
};

export const SceneShell: React.FC<{
  kicker?: string;
  heading?: string;
  accent?: string;
  children?: React.ReactNode;
}> = ({ kicker, heading, accent = theme.accent, children }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill
      style={{
        backgroundColor: theme.bg,
        backgroundImage: `radial-gradient(circle at 12% 8%, ${accent}14, transparent 45%)`,
        fontFamily: theme.sans,
        color: theme.text,
        padding: "72px 96px",
      }}
    >
      {kicker && (
        <div
          style={{
            ...fadeSlideIn(frame, 0, fps),
            color: accent,
            fontSize: 24,
            fontWeight: 700,
            letterSpacing: 3,
            textTransform: "uppercase",
            marginBottom: 14,
          }}
        >
          {kicker}
        </div>
      )}
      {heading && (
        <div
          style={{
            ...fadeSlideIn(frame, 4, fps),
            fontSize: 52,
            fontWeight: 800,
            lineHeight: 1.15,
            marginBottom: 36,
            maxWidth: 1600,
          }}
        >
          {heading}
        </div>
      )}
      {children}
    </AbsoluteFill>
  );
};

export const Panel: React.FC<{ children?: React.ReactNode; style?: React.CSSProperties }> = ({
  children,
  style,
}) => (
  <div
    style={{
      background: theme.panel,
      border: `1px solid ${theme.border}`,
      borderRadius: 16,
      padding: "28px 32px",
      ...style,
    }}
  >
    {children}
  </div>
);
