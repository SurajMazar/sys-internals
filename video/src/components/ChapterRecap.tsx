import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { theme } from "../theme";
import { fadeSlideIn, popIn, SceneShell, Panel } from "./shared";

export interface ChapterRecapProps {
  kicker?: string;
  heading?: string;
  takeaways: string[];
  next?: { title: string; teaser: string };
}

export const ChapterRecap: React.FC<ChapterRecapProps> = ({
  kicker = "RECAP",
  heading = "What to remember",
  takeaways,
  next,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <SceneShell kicker={kicker} heading={heading}>
      <div style={{ display: "flex", flexDirection: "column", gap: 18, marginBottom: 40 }}>
        {takeaways.map((t, i) => (
          <div key={i} style={{ ...fadeSlideIn(frame, 10 + i * 14, fps), display: "flex", gap: 16, alignItems: "flex-start" }}>
            <div
              style={{
                ...popIn(frame, 10 + i * 14, fps),
                width: 30,
                height: 30,
                borderRadius: 15,
                background: theme.ok,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 800,
                color: theme.bg,
                flexShrink: 0,
                marginTop: 4,
              }}
            >
              ✓
            </div>
            <div style={{ fontSize: 24, lineHeight: 1.4, maxWidth: 1450 }}>{t}</div>
          </div>
        ))}
      </div>
      {next && (
        <div style={{ ...fadeSlideIn(frame, 10 + takeaways.length * 14 + 20, fps, 40) }}>
          <Panel style={{ borderColor: theme.accent, maxWidth: 1250 }}>
            <div style={{ color: theme.accent, fontWeight: 700, fontSize: 17, letterSpacing: 2, marginBottom: 8 }}>NEXT UP</div>
            <div style={{ fontSize: 25, fontWeight: 800, marginBottom: 6 }}>{next.title}</div>
            <div style={{ color: theme.muted, fontSize: 19 }}>{next.teaser}</div>
          </Panel>
        </div>
      )}
    </SceneShell>
  );
};
