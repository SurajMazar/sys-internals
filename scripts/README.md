# "Listen to this chapter" narration pipeline

Adds an in-page, auto-scrolling, auto-advancing audio narration to a course chapter's HTML,
using local Kokoro TTS. Piloted on `uber-01.html`, then applied to all of `uber-01`..`uber-18`.
Separate from and unrelated to the `video/` Remotion pipeline (which pre-renders full narrated
MP4s for AWS chapters) — this feature narrates the page live in the browser instead of producing
a video file. Nothing about the pipeline is uber-specific; it should apply cleanly to any chapter
built on the same template (shared `stepper()` engine, `.widget`/`.callout`/`plain` markup).

## What it does, from the reader's side

A floating "Listen" control appears bottom-right on a narrated chapter. Pressing play:

- reads the chapter's actual prose (paragraphs, plain lists, callouts, the hero's lead/objectives)
  in document order, using the real on-page text — nothing is separately authored
- smooth-scrolls to and highlights whatever's currently being read
- auto-advances the chapter's stepper-deck widgets (the "STEP-BY-STEP" simulators) through their
  steps in sync with narration of each step's existing caption text
- lets the reader click any narrated paragraph, list, callout, or deck widget to jump playback
  there and resume from that point
- supports pause/resume (resumes the same clip, not from the start), and prev/next-cue skip

Code blocks, tables, and interactive widgets (quiz, order-quiz, sliders, timeline, architecture
explorer, the live simulator) are never narrated — they stay visual-only; the surrounding prose
already sets them up in context.

## Layout

```
scripts/
  add_narration_player.py  one-time-per-chapter: player CSS/HTML/JS + stepper() controller wiring
  extract_cues.py          chapter HTML -> assets/audio/<chapter>/cues.json + data-cue injection
  synthesize_narration.py  cues.json -> Kokoro audio + manifest, spliced inline into <chapter>.html
  narrate-chapter.sh       one command: scaffold -> extract -> synthesize

assets/audio/<chapter>/
  cues.json         intermediate — ordered list of narratable text/deck-step blocks (not shipped
                    separately; used only to drive synthesis)
  <cueId>.mp3       one clip per cue
  manifest.json     {chapter, voice, cues:[{id, kind, src, duration, selector|deckId+step}]} —
                    also spliced verbatim into <chapter>.html as an inline
                    <script type="application/json" id="narration-manifest"> block
```

Kokoro itself runs from the existing `video/tts/.venv` Python 3.11 virtualenv (see
`video/README.md` for that one-time setup) — this pipeline reuses it rather than creating a
second environment.

## How narration text is produced

`extract_cues.py <chapter>` walks `<chapter>.html` with a **whitelist** DOM walker: it only ever
emits a cue for four text constructs —

1. `<p>` (prose paragraphs, including `.lead`)
2. `<ul class="plain">` (all `<li>` joined into one cue)
3. `<div class="callout ...">` (its child `<p>`s joined; the `.co-t` label is skipped)
4. the hero's `<div class="objectives">` (all `.obj` entries joined)

— plus one deck construct: every `<div class="widget deck" id="...">` found in the HTML, in
document order. **Nothing about deck ids, count, or which section they sit in is hardcoded** —
each is discovered directly from the markup, so the same script handles a chapter with two decks
in different sections just as well as one with three (verified: every `uber-*` chapter's deck ids,
counts, and positions differ completely, and none needed a script change). Each deck's step `cap`
captions are recovered from its own `stepper("deckId", ...)` call, scoped to that call's *entire
enclosing* `(function(){ ... })();` block (found generically by brace-counting, not by a
chapter-specific comment anchor) — this matters because some decks pass a `steps` variable
declared earlier in the same IIFE rather than an inline array literal, so the caption text can
appear *before* the call itself. Confirmed by inspection that every chapter gives each deck its own
dedicated IIFE, so this scoping never mixes one deck's captions into another's.

Everything else — code blocks, tables, canvases, sliders, the quiz/order-quiz/live-sim — is
excluded automatically, simply by never matching one of the constructs above; there's no exclusion
list to keep in sync as the chapter changes. A deck whose `stepper()` call or `cap:` templates
can't be found is skipped with a warning rather than aborting the whole chapter.

Text cues get a stable `data-cue="s3-p2"`-style id injected onto the element itself (idempotent —
re-running strips and regenerates these, so it's safe to run repeatedly, e.g. after editing prose).
Deck cues need no injection; they target the deck's own existing `id`.

## Synthesizing audio

`synthesize_narration.py <chapter>` reads `cues.json`, synthesizes each cue with Kokoro
(`af_heart` voice — same default as the video pipeline), converts wav → mp3 via `ffmpeg` (96kbps,
discarding the wav), and writes `manifest.json`. It then splices that manifest as an inline
`<script id="narration-manifest">` block into `<chapter>.html`, replacing any previous one.

**Incremental re-runs:** each manifest entry stores a short hash of the narration text it was
synthesized from. Re-running only resynthesizes cues whose text actually changed (or whose mp3 is
missing) — e.g. after tweaking prose, editing narration further, or (as happened once) fixing a
cue-ordering bug that didn't change any cue's *text*. Delete a chapter's `assets/audio/<chapter>/`
directory to force a full resynthesis from scratch.

**Why inline and not `fetch()`-ed:** the site is meant to also work opened directly from
`file://`, where `fetch()` of a local JSON file is blocked by the browser. Embedding the manifest
as a `<script type="application/json">` block sidesteps that entirely — audio playback itself
(`<audio src="...">`) is unaffected either way.

Run both steps with:

```bash
video/tts/.venv/bin/python scripts/synthesize_narration.py uber-01
# or, to also (re)run extraction first:
scripts/narrate-chapter.sh uber-01
```

First run downloads Kokoro's model weights (~300MB) to `~/.cache/huggingface`. A ~58-cue chapter
takes several minutes on CPU.

## The player

Added directly to the chapter's `<style>`/`<body>` (no build step, no bundler — plain inline
`<script>`, matching how the rest of the site is authored). `add_narration_player.py` applies this
scaffold mechanically and idempotently:

- `stepper()` (the shared deck engine) now returns `{go, index, length}`, registered per-deck on
  `window.__decks` — the one small, additive change to existing chapter JS this feature needs.
  Applied by a plain string replace of the function's exact tail (`prev.onclick = ...; go(0); }`),
  safe because that function body was verified byte-identical across all 18 chapters
- every `stepper("deckId", ...)` call site gets rewritten to `window.__decks.deckId = stepper(...)`,
  one per deck id discovered from the HTML
- the player script waits for `DOMContentLoaded` before reading the manifest, so it doesn't depend
  on where the inline manifest `<script>` tag happens to land relative to the player's own script
- if a chapter has no `#narration-manifest` block yet (narration not synthesized), the player
  script no-ops and stays hidden — the page works exactly as before
- clicking any narrated paragraph/list/callout, or a deck widget, jumps narration to that point and
  resumes playing from there (deck clicks resolve to whichever step the deck is currently showing)

## Adding narration to another chapter

1. `scripts/narrate-chapter.sh <chapter>` (e.g. `uber-19`) — runs the scaffold, extraction, and
   synthesis in one command; each step is independently idempotent, so re-running after an error
   or a prose edit only redoes what changed
2. Spot-check `assets/audio/<chapter>/cues.json` for anything that reads oddly once tags are
   stripped (dense inline codes like `TryClaim`, `O(N)` are the known Kokoro rough edge — same
   one documented in `video/README.md` — fix by rewording the source prose, not the pipeline)
3. Commit the chapter's `.mp3`s and the modified `.html`

If the new chapter's `stepper()` body or deck markup has actually diverged from the shared
template, `add_narration_player.py` fails loudly (rather than silently mis-wiring) — fix the
mismatch by hand for that one chapter and rerun.

## Known limitations

- Narration granularity is per-paragraph/list/callout/deck-step (not word- or sentence-level), so
  auto-scroll moves every ~10–30s, not continuously
- Dense inline technical shorthand can read awkwardly through TTS; reword the source prose if a
  clip sounds wrong rather than patching pronunciation in the pipeline
- Headings (`h2.sec`, `h3`) are not narrated — they stay as pure visual scroll anchors
