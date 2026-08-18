import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { theme } from "../theme";
import { fadeSlideIn, popIn, SceneShell, Panel } from "./shared";

export interface AnswerRevealItem {
  prompt: string;
  correct: string;
  rationale: string;
}

export interface AnswerRevealProps {
  kicker?: string;
  heading?: string;
  answers: AnswerRevealItem[];
  framesPerAnswer?: number;
  /** Injected automatically by ChapterVideo; used to pace answers to the scene's real length. */
  durationInFrames?: number;
}

export const AnswerReveal: React.FC<AnswerRevealProps> = ({
  kicker = "ANSWERS",
  heading = "Here's why",
  answers,
  framesPerAnswer,
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const perAnswer = framesPerAnswer ?? (durationInFrames ? Math.floor(durationInFrames / answers.length) : 150);
  const aIndex = Math.min(answers.length - 1, Math.floor(frame / perAnswer));
  const local = frame - aIndex * perAnswer;
  const a = answers[aIndex];

  return (
    <SceneShell kicker={kicker} heading={heading}>
      <div key={aIndex} style={{ ...fadeSlideIn(local, 0, fps), maxWidth: 1550 }}>
        <div style={{ fontSize: 23, color: theme.muted, marginBottom: 18 }}>{a.prompt}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 22, ...popIn(local, 10, fps) }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              background: theme.ok,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 800,
              color: theme.bg,
              flexShrink: 0,
            }}
          >
            ✓
          </div>
          <div style={{ fontSize: 28, fontWeight: 800 }}>{a.correct}</div>
        </div>
        <div style={{ ...fadeSlideIn(local, 30, fps) }}>
          <Panel style={{ fontSize: 21, lineHeight: 1.5 }}>{a.rationale}</Panel>
        </div>
      </div>
    </SceneShell>
  );
};
