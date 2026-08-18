import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { theme } from "../theme";
import { fadeSlideIn, popIn } from "./shared";

export interface FinalChallengeProps {
  kicker?: string;
  prompt: string;
  hint?: string;
  nextChapterTitle?: string;
}

export const FinalChallenge: React.FC<FinalChallengeProps> = ({
  kicker = "THINK ABOUT IT",
  prompt,
  hint,
  nextChapterTitle,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill
      style={{
        backgroundColor: theme.bg,
        backgroundImage: `radial-gradient(circle at 50% 100%, ${theme.accent}20, transparent 55%)`,
        fontFamily: theme.sans,
        color: theme.text,
        justifyContent: "center",
        alignItems: "center",
        textAlign: "center",
        padding: "0 180px",
      }}
    >
      <div
        style={{
          ...fadeSlideIn(frame, 0, fps),
          color: theme.accent,
          fontSize: 24,
          fontWeight: 700,
          letterSpacing: 4,
          textTransform: "uppercase",
          marginBottom: 26,
        }}
      >
        {kicker}
      </div>
      <div style={{ ...popIn(frame, 10, fps), fontSize: 42, fontWeight: 800, lineHeight: 1.35, marginBottom: 28 }}>
        {prompt}
      </div>
      {hint && <div style={{ ...fadeSlideIn(frame, 40, fps), color: theme.muted, fontSize: 23, marginBottom: 44 }}>{hint}</div>}
      {nextChapterTitle && (
        <div style={{ ...fadeSlideIn(frame, 60, fps), fontSize: 21, color: theme.muted }}>
          Continue in <span style={{ color: theme.accent, fontWeight: 700 }}>{nextChapterTitle}</span> →
        </div>
      )}
    </AbsoluteFill>
  );
};
