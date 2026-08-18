/* Palette lifted from ../assets/site.css (dark theme) so the video matches the site. */
export const theme = {
  bg: "#07090d",
  bg2: "#0b0e15",
  panel: "#0e1219",
  panel2: "#131824",
  border: "#1c2330",
  borderHi: "#2a3446",
  text: "#e8ecf4",
  muted: "#8b94a7",
  dim: "#5b6475",
  accent: "#ff9900", // --aws
  ok: "#4ade80",
  warn: "#facc15",
  bad: "#f87171",
  mono: '"SF Mono", "JetBrains Mono", "Fira Code", Menlo, Consolas, monospace',
  sans: '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, sans-serif',
} as const;

export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;

/** Frames of trailing silence appended after each scene's narration clip. */
export const SCENE_TAIL_FRAMES = 12;
