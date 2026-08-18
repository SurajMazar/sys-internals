import { FPS, SCENE_TAIL_FRAMES } from "../theme";

export interface StoryboardScene {
  id: string;
  type: string;
  narration?: string;
  props: Record<string, unknown>;
}

export interface Storyboard {
  chapter: string;
  title: string;
  voice: string;
  scenes: StoryboardScene[];
}

export type Durations = Record<string, number>;

/** Used only before Kokoro has synthesized real audio, so Studio/build never breaks. */
const FALLBACK_SECONDS = 6;

export function sceneDurationFrames(sceneId: string, durations: Durations): number {
  const seconds = durations[sceneId] ?? FALLBACK_SECONDS;
  return Math.max(30, Math.round(seconds * FPS) + SCENE_TAIL_FRAMES);
}

export function computeTotalFrames(storyboard: Storyboard, durations: Durations): number {
  return storyboard.scenes.reduce((sum, s) => sum + sceneDurationFrames(s.id, durations), 0);
}
