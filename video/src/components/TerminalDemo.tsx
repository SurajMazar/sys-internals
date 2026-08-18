import React from "react";
import { useCurrentFrame } from "remotion";
import { theme } from "../theme";
import { SceneShell } from "./shared";

export interface TerminalStep {
  cmd: string;
  output?: string[];
}

export interface TerminalDemoProps {
  kicker?: string;
  heading?: string;
  prompt?: string;
  steps: TerminalStep[];
  framesPerStep?: number;
  /** Injected automatically by ChapterVideo; used to pace steps to the scene's real length. */
  durationInFrames?: number;
}

export const TerminalDemo: React.FC<TerminalDemoProps> = ({
  kicker,
  heading,
  prompt = "$",
  steps,
  framesPerStep,
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const perStep = framesPerStep ?? (durationInFrames ? Math.floor(durationInFrames / steps.length) : 70);

  return (
    <SceneShell kicker={kicker} heading={heading}>
      <div
        style={{
          background: "#05070a",
          border: `1px solid ${theme.border}`,
          borderRadius: 14,
          padding: "26px 30px",
          fontFamily: theme.mono,
          fontSize: 20,
          maxWidth: 1600,
          minHeight: 460,
        }}
      >
        {steps.map((step, i) => {
          const stepStart = i * perStep;
          const local = frame - stepStart;
          if (local < 0) return null;
          const typedChars = Math.min(step.cmd.length, Math.floor(local / 1.4));
          const typedCmd = step.cmd.slice(0, typedChars);
          const showCursor = typedChars < step.cmd.length && Math.floor(local / 8) % 2 === 0;
          const outputVisible = local > step.cmd.length * 1.4 + 6;
          return (
            <div key={i} style={{ marginBottom: 18 }}>
              <div style={{ color: theme.ok }}>
                <span style={{ color: theme.accent }}>{prompt} </span>
                {typedCmd}
                {showCursor && <span style={{ opacity: 0.8 }}>▌</span>}
              </div>
              {outputVisible &&
                step.output?.map((o, oi) => (
                  <div key={oi} style={{ color: theme.muted, paddingLeft: 4 }}>
                    {o}
                  </div>
                ))}
            </div>
          );
        })}
      </div>
    </SceneShell>
  );
};
