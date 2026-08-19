#!/usr/bin/env python3
"""
Synthesize per-cue narration audio for a chapter's "listen to this chapter"
feature, using local Kokoro TTS (same model/pattern as video/tts/synthesize.py).

Reads assets/audio/<chapter>/cues.json (written by scripts/extract_cues.py).
Writes:
  assets/audio/<chapter>/<cueId>.mp3     one clip per cue (wav is synthesized
                                          then converted via ffmpeg and discarded)
  assets/audio/<chapter>/manifest.json   {chapter, voice, cues:[{id,kind,src,
                                          duration, selector|deckId+step}]}

Also splices the manifest into <chapter>.html as an inline
<script type="application/json" id="narration-manifest"> block, right before
</body> — not fetched via fetch() so the page keeps working from file://.

Re-running is idempotent and incremental: each manifest entry records a hash
of the narration text it was synthesized from. A cue whose mp3 already exists
and whose text hash is unchanged is skipped — only new or edited cues (e.g.
after a prose tweak, or a reordering of decks vs. paragraphs) re-run Kokoro.
Delete a chapter's assets/audio/<chapter>/ dir to force a full resynthesis.

Usage: video/tts/.venv/bin/python scripts/synthesize_narration.py uber-01
"""
import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path

import numpy as np
import soundfile as sf

ROOT = Path(__file__).resolve().parent.parent
SAMPLE_RATE = 24000
VOICE = "af_heart"  # American English, female — instructor-style; same default as video/tts/synthesize.py

MANIFEST_MARKER_RE = re.compile(
    r'\n?<script type="application/json" id="narration-manifest">.*?</script>\n?',
    re.S,
)


def text_hash(text):
    return hashlib.sha1(text.encode("utf-8")).hexdigest()[:12]


def synthesize(chapter):
    audio_dir = ROOT / "assets" / "audio" / chapter
    cues = json.loads((audio_dir / "cues.json").read_text())

    prior_manifest_path = audio_dir / "manifest.json"
    prior_by_id = {}
    if prior_manifest_path.exists():
        prior_by_id = {c["id"]: c for c in json.loads(prior_manifest_path.read_text()).get("cues", [])}

    pipeline = None  # lazily created only if some cue actually needs synthesis

    manifest_cues = []
    for cue in cues:
        text = cue["text"].strip()
        if not text:
            print(f'  [{cue["id"]}] empty narration text, skipping')
            continue

        mp3_path = audio_dir / f'{cue["id"]}.mp3'
        h = text_hash(text)
        prior = prior_by_id.get(cue["id"])
        if prior and prior.get("text_hash") == h and mp3_path.exists():
            duration = prior["duration"]
            print(f'  [{cue["id"]}] unchanged, reusing existing clip ({duration:.1f}s)')
        else:
            if pipeline is None:
                from kokoro import KPipeline
                pipeline = KPipeline(lang_code="a")
            print(f'  [{cue["id"]}] synthesizing ({len(text)} chars)...')
            chunks = [r.audio for r in pipeline(text, voice=VOICE)]
            audio = np.concatenate([c.numpy() if hasattr(c, "numpy") else np.asarray(c) for c in chunks])

            wav_path = audio_dir / f'{cue["id"]}.wav'
            sf.write(str(wav_path), audio, SAMPLE_RATE)
            duration = round(len(audio) / SAMPLE_RATE, 3)

            subprocess.run(
                ["ffmpeg", "-y", "-loglevel", "error", "-i", str(wav_path),
                 "-codec:a", "libmp3lame", "-b:a", "96k", str(mp3_path)],
                check=True,
            )
            wav_path.unlink()
            print(f'  [{cue["id"]}] -> {mp3_path.name} ({duration:.1f}s)')

        entry = {
            "id": cue["id"],
            "kind": cue["kind"],
            "src": f"assets/audio/{chapter}/{cue['id']}.mp3",
            "duration": duration,
            "text_hash": h,
        }
        if cue["kind"] == "text":
            entry["selector"] = cue["selector"]
        else:
            entry["deckId"] = cue["deckId"]
            entry["step"] = cue["step"]
        manifest_cues.append(entry)

    manifest = {"chapter": chapter, "voice": VOICE, "cues": manifest_cues}
    (audio_dir / "manifest.json").write_text(json.dumps(manifest, indent=2))
    print(f"Wrote manifest for {len(manifest_cues)} cues.")

    splice_inline_manifest(chapter, manifest)


def splice_inline_manifest(chapter, manifest):
    html_path = ROOT / f"{chapter}.html"
    source = html_path.read_text()
    source = MANIFEST_MARKER_RE.sub("", source)  # strip any previous block first (idempotent re-run)

    block = (
        '\n<script type="application/json" id="narration-manifest">'
        + json.dumps(manifest)
        + "</script>\n"
    )
    idx = source.rindex("</body>")
    source = source[:idx] + block + source[idx:]
    html_path.write_text(source)
    print(f"Spliced inline narration-manifest into {html_path.name}.")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("usage: synthesize_narration.py <chapter-id>", file=sys.stderr)
        sys.exit(1)
    synthesize(sys.argv[1])
