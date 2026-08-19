#!/usr/bin/env bash
# One command for the "listen to this chapter" narration pipeline: adds the
# player scaffold (if not already present), extracts narration cues from a
# chapter's HTML, then synthesizes audio with Kokoro.
# See scripts/README.md for how the pipeline works.
#
# Usage: scripts/narrate-chapter.sh uber-01
set -euo pipefail
CHAPTER="${1:?usage: narrate-chapter.sh <chapter-id>   e.g. uber-01}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "==> [1/3] Adding player scaffold (CSS/HTML/JS, stepper wiring)..."
python3 "$ROOT/scripts/add_narration_player.py" "$CHAPTER"

echo "==> [2/3] Extracting narration cues + injecting data-cue attrs..."
python3 "$ROOT/scripts/extract_cues.py" "$CHAPTER"

echo "==> [3/3] Synthesizing narration with Kokoro + writing manifest..."
"$ROOT/video/tts/.venv/bin/python" "$ROOT/scripts/synthesize_narration.py" "$CHAPTER"

echo "Done: assets/audio/${CHAPTER}/ + inline manifest spliced into ${CHAPTER}.html"
