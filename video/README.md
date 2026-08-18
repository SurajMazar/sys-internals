# AWS course video pipeline

Turns an AWS chapter's narrative into a narrated, animated video: a Remotion (React) composition
assembled from 9 reusable scene components, narrated by local Kokoro TTS. One chapter — `aws-01` —
has been produced end to end as the pilot. Extending to the rest of the AWS course follows the same
recipe below.

This is separate from the main site's build (which has none): it's a real Node/Python project, kept
out of the deploy via `.vercelignore` — only the rendered `assets/video/<chapter>.mp4` ships.

## Layout

```
video/
  src/
    Root.tsx                     one <Composition> per chapter, registered here
    index.ts                     registerRoot() entry point
    theme.ts                     palette (lifted from ../assets/site.css) + video constants
    compositions/
      ChapterVideo.tsx           assembles a storyboard's scenes into <Sequence>s + <Audio>
      timing.ts                  scene duration math (audio length + trailing pause)
    components/                  the 9 reusable scene types (see below)
    content/
      <chapter>.storyboard.json  the script: ordered scenes, narration text, per-scene props
      <chapter>.durations.json   {sceneId: seconds} — written by the TTS step, read by Root.tsx
  public/audio/<chapter>/        Kokoro's .wav output, one file per scene (gitignored, regenerated)
  out/                           Remotion's render output before it's copied to assets/ (gitignored)

video/tts/
  synthesize.py                  reads a storyboard, calls Kokoro per scene, writes audio + durations
  requirements.txt                kokoro, soundfile (pulls in torch/transformers/misaki[en])
  .venv/                          Python 3.11 virtualenv (gitignored) — Kokoro requires <3.13

scripts/render-chapter.sh        one command: synth -> render -> copy into assets/video/
```

## The 9 scene components

All in `src/components/`, all prop-driven (no hardcoded chapter content), themed off `theme.ts`:

| Component | Used for |
| --- | --- |
| `ChapterIntro` | Title card + a few headline facts |
| `ConceptScene` | Bullets, numbered steps, a case-study profile, or a small table (`variant` prop) |
| `ArchitectureDiagram` | A comparison table or an animated grouped bar chart (`variant` prop) |
| `CodeScene` | A revealed code block or file-tree listing (`variant` prop) |
| `TerminalDemo` | A typed-out multi-command terminal session with output |
| `KnowledgeCheck` | One or more MC questions, options revealed in sequence |
| `AnswerReveal` | Matching answers + rationale, checkmark reveal |
| `ChapterRecap` | Numbered takeaways + a "next chapter" card |
| `FinalChallenge` | A single closing cliffhanger scenario |

`ConceptScene` and `ArchitectureDiagram` both render tables — pick whichever variant looks right for
the content; they're intentionally overlapping so you're not stuck if a scene doesn't fit neatly into
one category.

## How the timing works

There is no forced word-level alignment. Sync is **scene-level**: each scene's `narration` string is
synthesized to one audio clip, and that clip's real duration (plus `SCENE_TAIL_FRAMES` of trailing
pause, from `theme.ts`) becomes the scene's `<Sequence>` length. Multi-item components
(`KnowledgeCheck`, `AnswerReveal`, `TerminalDemo`, `CodeScene`) receive the scene's total
`durationInFrames` as an extra prop (injected automatically by `ChapterVideo.tsx`) and divide it
evenly across their items, so pacing tracks the real narration length instead of a guessed constant.

Before audio exists, `sceneDurationFrames()` (`compositions/timing.ts`) falls back to a flat 6 seconds
per scene, so `npm run studio` and `tsc` never break just because Kokoro hasn't run yet.

## Adding the next chapter

1. Write `src/content/<chapter>.storyboard.json` — see `aws-01.storyboard.json` for the shape:
   ```json
   { "chapter": "aws-02", "title": "...", "voice": "am_michael",
     "scenes": [ { "id": "...", "type": "ConceptScene", "narration": "...", "props": { ... } } ] }
   ```
   Keep narration conversational — spell out an acronym phonetically the first time it's said (e.g.
   "S A A, C zero three"), then switch to plain words ("the associate exam") for the rest of the
   chapter. On-screen `props` text can stay in its normal written form regardless.
2. Seed a placeholder `src/content/<chapter>.durations.json` (any positive numbers — real values get
   overwritten by step 3) so `Root.tsx` can import it before audio exists. Register a new
   `<Composition id="<chapter>" .../>` in `Root.tsx` alongside the aws-01 one.
3. Run `scripts/render-chapter.sh <chapter>`. This synthesizes narration, renders the mp4, and copies
   it to `assets/video/<chapter>.mp4`.
4. Embed it in `<chapter>.html`: `<video controls preload="none" src="assets/video/<chapter>.mp4"></video>`
   near the top of the page, above the existing prose sections.

## Local setup (already done for aws-01, needed once per machine)

```bash
cd video && npm install
python3.11 -m venv tts/.venv && tts/.venv/bin/pip install -r tts/requirements.txt
```

Kokoro's first run downloads model weights (~300MB) from Hugging Face to `~/.cache/huggingface`.
Kokoro requires Python **< 3.13**; if the system Python is newer, install 3.11 via
`brew install python@3.11` and point the venv at it explicitly, as above.

## Known rough edges

- **Pronunciation**: Kokoro handles common acronyms fine but can stumble on dense alphanumeric codes
  (`SAA-C03`). The storyboard convention above (spell once, then say it in words) is the workaround —
  listen to a new chapter's `intro` clip first and adjust narration wording if it sounds off, rather
  than fighting the model.
- **Render time**: a ~6–8 minute chapter renders in low tens of minutes on CPU (no GPU acceleration
  configured). `remotion studio` for previewing individual scenes is much faster than a full render.
- **File size**: rendered mp4s are committed to git (`assets/video/`) per the project's current
  hosting choice. This is fine for a handful of chapters; producing all 24 this way will add several
  GB to the repo — worth revisiting (external storage + CDN) before scaling past a few chapters.
