import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { theme } from "../theme";
import { fadeSlideIn, popIn, Panel } from "./shared";

export interface ChapterIntroProps {
  kicker: string;
  title: string;
  facts: { label: string; value: string }[];
}

export const ChapterIntro: React.FC<ChapterIntroProps> = ({ kicker, title, facts }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill
      style={{
        backgroundColor: theme.bg,
        backgroundImage: `radial-gradient(circle at 50% 0%, ${theme.accent}22, transparent 55%)`,
        fontFamily: theme.sans,
        color: theme.text,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div style={{ textAlign: "center", maxWidth: 1500 }}>
        <div
          style={{
            ...fadeSlideIn(frame, 0, fps),
            color: theme.accent,
            fontSize: 26,
            fontWeight: 700,
            letterSpacing: 4,
            textTransform: "uppercase",
            marginBottom: 22,
          }}
        >
          {kicker}
        </div>
        <div style={{ ...fadeSlideIn(frame, 8, fps), fontSize: 68, fontWeight: 800, lineHeight: 1.12, marginBottom: 56 }}>
          {title}
        </div>
        <div style={{ display: "flex", gap: 28, justifyContent: "center", flexWrap: "wrap" }}>
          {facts.map((f, i) => (
            <div key={f.label} style={{ ...popIn(frame, 20 + i * 8, fps) }}>
              <Panel style={{ minWidth: 380, textAlign: "left" }}>
                <div style={{ color: theme.accent, fontWeight: 700, fontSize: 21, marginBottom: 8 }}>{f.label}</div>
                <div style={{ color: theme.muted, fontSize: 19 }}>{f.value}</div>
              </Panel>
            </div>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};
