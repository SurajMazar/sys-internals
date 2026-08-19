#!/usr/bin/env bash
# Render a chapter video end to end: Kokoro narration -> Remotion render -> copy into assets/.
#
# Usage: scripts/render-chapter.sh aws-01
set -euo pipefail

CHAPTER="${1:-}"
if [[ -z "$CHAPTER" ]]; then
  echo "usage: $(basename "$0") <chapter-id>   e.g. aws-01" >&2
  exit 1
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VIDEO_DIR="$ROOT/video"
STORYBOARD="$VIDEO_DIR/src/content/${CHAPTER}.storyboard.json"

if [[ ! -f "$STORYBOARD" ]]; then
x   exit 1
fi

echo "==> [1/3] Synthesizing narration with Kokoro..."
"$VIDEO_DIR/tts/.venv/bin/python" "$VIDEO_DIR/tts/synthesize.py" "$CHAPTER"

echo "==> [2/3] Rendering with Remotion..."
mkdir -p "$VIDEO_DIR/out"
(cd "$VIDEO_DIR" && npx remotion render src/index.ts "$CHAPTER" "out/${CHAPTER}.mp4")

echo "==> [3/3] Copying to assets/video/${CHAPTER}.mp4..."
mkdir -p "$ROOT/assets/video"
cp "$VIDEO_DIR/out/${CHAPTER}.mp4" "$ROOT/assets/video/${CHAPTER}.mp4"

echo "Done: assets/video/${CHAPTER}.mp4"
