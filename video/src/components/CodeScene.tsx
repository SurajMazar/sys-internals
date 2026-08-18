import React from "react";
import { useCurrentFrame } from "remotion";
import { theme } from "../theme";
import { SceneShell, Panel } from "./shared";

export interface CodeSceneProps {
  kicker?: string;
  heading?: string;
  variant?: "code" | "tree";
  filename?: string;
  lines: string[];
  linesPerFrame?: number;
  /** Injected automatically by ChapterVideo; used to pace reveal to the scene's real length. */
  durationInFrames?: number;
}

export const CodeScene: React.FC<CodeSceneProps> = ({
  kicker,
  heading,
  variant = "code",
  filename,
  lines,
  linesPerFrame,
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const framesPerLine =
    linesPerFrame ?? (durationInFrames ? Math.max(6, Math.floor((durationInFrames - 40) / Math.max(1, lines.length))) : 12);
  const visible = Math.min(lines.length, Math.floor(frame / framesPerLine) + 1);

  return (
    <SceneShell kicker={kicker} heading={heading}>
      <Panel style={{ maxWidth: 1500, fontFamily: theme.mono }}>
        {filename && (
          <div style={{ color: theme.muted, fontSize: 17, marginBottom: 16, borderBottom: `1px solid ${theme.border}`, paddingBottom: 12 }}>
            {filename}
          </div>
        )}
        {lines.slice(0, visible).map((line, i) => (
          <div
            key={i}
            style={{ fontSize: 21, color: variant === "tree" ? theme.text : theme.ok, lineHeight: 1.7, whiteSpace: "pre" }}
          >
            {line}
          </div>
        ))}
      </Panel>
    </SceneShell>
  );
};
