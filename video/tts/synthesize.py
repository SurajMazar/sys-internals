#!/usr/bin/env python3
"""
Turn a chapter storyboard's narration text into per-scene audio, using local
Kokoro TTS inference. Writes:

  video/public/audio/<chapter>/<sceneId>.wav   one clip per scene
  video/public/audio/<chapter>/durations.json  {sceneId: seconds}
  video/src/content/<chapter>.durations.json   same content, importable by Remotion

Usage: .venv/bin/python synthesize.py aws-01
"""
import json
import sys
from pathlib import Path

import numpy as np
import soundfile as sf

SAMPLE_RATE = 24000
VIDEO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_VOICE = "af_heart"  # American English, female — instructor-style


def synthesize_chapter(chapter: str) -> None:
    storyboard_path = VIDEO_ROOT / "src" / "content" / f"{chapter}.storyboard.json"
    storyboard = json.loads(storyboard_path.read_text())
    voice = storyboard.get("voice", DEFAULT_VOICE)

    out_dir = VIDEO_ROOT / "public" / "audio" / chapter
    out_dir.mkdir(parents=True, exist_ok=True)

    from kokoro import KPipeline

    pipeline = KPipeline(lang_code="a")

    durations: dict[str, float] = {}
    for scene in storyboard["scenes"]:
        scene_id = scene["id"]
        narration = scene.get("narration", "").strip()
        if not narration:
            print(f"  [{scene_id}] no narration text, skipping audio")
            continue

        print(f"  [{scene_id}] synthesizing ({len(narration)} chars)...")
        chunks = [result.audio for result in pipeline(narration, voice=voice)]
        audio = np.concatenate([c.numpy() if hasattr(c, "numpy") else np.asarray(c) for c in chunks])

        wav_path = out_dir / f"{scene_id}.wav"
        sf.write(str(wav_path), audio, SAMPLE_RATE)
        seconds = len(audio) / SAMPLE_RATE
        durations[scene_id] = round(seconds, 3)
        print(f"  [{scene_id}] -> {wav_path.name} ({seconds:.1f}s)")

    durations_json = json.dumps(durations, indent=2)
    (out_dir / "durations.json").write_text(durations_json)
    content_dir = VIDEO_ROOT / "src" / "content"
    (content_dir / f"{chapter}.durations.json").write_text(durations_json)
    print(f"Wrote durations for {len(durations)} scenes.")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("usage: synthesize.py <chapter-id>", file=sys.stderr)
        sys.exit(1)
    synthesize_chapter(sys.argv[1])
