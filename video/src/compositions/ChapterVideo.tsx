import React from "react";
import { AbsoluteFill, Audio, Sequence, staticFile } from "remotion";
import { theme } from "../theme";
import { sceneDurationFrames, Durations, Storyboard } from "./timing";
import { ChapterIntro } from "../components/ChapterIntro";
import { ConceptScene } from "../components/ConceptScene";
import { ArchitectureDiagram } from "../components/ArchitectureDiagram";
import { CodeScene } from "../components/CodeScene";
import { TerminalDemo } from "../components/TerminalDemo";
import { KnowledgeCheck } from "../components/KnowledgeCheck";
import { AnswerReveal } from "../components/AnswerReveal";
import { ChapterRecap } from "../components/ChapterRecap";
import { FinalChallenge } from "../components/FinalChallenge";

/** The 9 reusable scene components, keyed by the `type` field storyboards use. */
const COMPONENTS: Record<string, React.ComponentType<any>> = {
  ChapterIntro,
  ConceptScene,
  ArchitectureDiagram,
  CodeScene,
  TerminalDemo,
  KnowledgeCheck,
  AnswerReveal,
  ChapterRecap,
  FinalChallenge,
};

export interface ChapterVideoProps {
  storyboard: Storyboard;
  durations: Durations;
  chapterId: string;
}

export const ChapterVideo: React.FC<ChapterVideoProps> = ({ storyboard, durations, chapterId }) => {
  let cursor = 0;
  return (
    <AbsoluteFill style={{ backgroundColor: theme.bg }}>
      {storyboard.scenes.map((scene) => {
        const dur = sceneDurationFrames(scene.id, durations);
        const from = cursor;
        cursor += dur;
        const Comp = COMPONENTS[scene.type];
        if (!Comp) return null;
        const hasAudio = typeof durations[scene.id] === "number";
        return (
          <Sequence key={scene.id} from={from} durationInFrames={dur} name={scene.id}>
            <Comp {...scene.props} durationInFrames={dur} />
            {hasAudio && <Audio src={staticFile(`audio/${chapterId}/${scene.id}.wav`)} />}
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
