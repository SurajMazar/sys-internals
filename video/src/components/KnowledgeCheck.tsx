import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { theme } from "../theme";
import { fadeSlideIn, SceneShell, Panel } from "./shared";

export interface KnowledgeCheckQuestion {
  level: "ASSOCIATE" | "PROFESSIONAL";
  prompt: string;
  options: string[];
}

export interface KnowledgeCheckProps {
  kicker?: string;
  heading?: string;
  questions: KnowledgeCheckQuestion[];
  framesPerQuestion?: number;
  /** Injected automatically by ChapterVideo; used to pace questions to the scene's real length. */
  durationInFrames?: number;
}

export const KnowledgeCheck: React.FC<KnowledgeCheckProps> = ({
  kicker = "KNOWLEDGE CHECK",
  heading = "Try these before the answer",
  questions,
  framesPerQuestion,
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const perQuestion = framesPerQuestion ?? (durationInFrames ? Math.floor(durationInFrames / questions.length) : 150);
  const qIndex = Math.min(questions.length - 1, Math.floor(frame / perQuestion));
  const local = frame - qIndex * perQuestion;
  const q = questions[qIndex];

  return (
    <SceneShell kicker={kicker} heading={heading}>
      <div key={qIndex} style={{ ...fadeSlideIn(local, 0, fps) }}>
        <div style={{ color: theme.accent, fontWeight: 700, fontSize: 17, letterSpacing: 2, marginBottom: 10 }}>{q.level}</div>
        <div style={{ fontSize: 28, marginBottom: 28, maxWidth: 1550, lineHeight: 1.4 }}>{q.prompt}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {q.options.map((opt, i) => (
            <div key={i} style={{ ...fadeSlideIn(local, 20 + i * 10, fps, 40) }}>
              <Panel style={{ maxWidth: 1350 }}>
                <span style={{ color: theme.muted, marginRight: 12 }}>{String.fromCharCode(65 + i)}.</span>
                {opt}
              </Panel>
            </div>
          ))}
        </div>
      </div>
    </SceneShell>
  );
};
