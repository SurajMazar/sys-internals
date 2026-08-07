# SPEC — Hands-On Lab track

Three files: `pg-lab.html`, `kafka-lab.html`, `wa-lab.html`. These are the PRACTICAL companion to the
theory courses (pg-01..21, kafka-01..15, wa-01..12). The theory courses deliberately contain no usage
material — these fill that gap entirely.

## Reference implementation
`pg-01.html` is the CANONICAL TEMPLATE for CSS and chrome. Copy its entire `<style>` block and its
`#topbar`, `#toc`, `#readbar`, hero, and the closing chrome JS (readbar, scrollspy, keyboard nav, mark-done).
Accent per file: pg-lab `--pg:#60a5fa` (blue, unchanged), kafka-lab `--pg:#f25c54` (red),
wa-lab `--pg:#4ade80` (green). Reuse the `stepper()` and `qaCards()` helpers where useful.

Topbar crumb: `<COURSE NAME> · <b>HANDS-ON LAB</b> · <SHORT NAME>`

## What makes a LAB different from a chapter
A chapter derives mechanism. A lab makes the learner **run something and observe a result**. Every lab
exercise must have: a goal, exact copy-pasteable commands, the **expected output** (real, realistic output —
not hand-waved), and an explanation of what the output proves, linking back to the specific theory chapter.

## Required structure — 7 top-level sections, ids `s1`..`s7`
1. `s1` **SETUP** — Docker/docker-compose environment. A complete, correct `docker-compose.yml` the learner
   can copy, plus prerequisites, resource requirements, startup verification commands, and teardown.
   Must be genuinely runnable and correct (real image names, real ports, real env vars, real healthchecks).
   Include a troubleshooting subsection for the common startup failures.
2. `s2` **ORIENTATION** — first contact: connect, create something, verify it works. The 10-minute
   "is my environment sane" path.
3. `s3` **PROVE-THE-INTERNALS EXPERIMENTS** — the heart of the file. A numbered series of experiments,
   each one making a mechanism from the theory course directly observable. Each experiment gets:
   objective → setup commands → the observation command → expected output → "what this proves" tied to a
   named chapter. Aim for 12-18 experiments covering the course's major subsystems.
4. `s4` **PRODUCTION BEST PRACTICES** — a config cookbook with reasoning (never a bare list of settings:
   every recommendation states the mechanism that justifies it and the failure it prevents), design rules,
   anti-patterns with the damage each causes, and a sizing/tuning checklist.
5. `s5` **OPERATIONAL RUNBOOKS** — step-by-step procedures for real operations, each with preconditions,
   steps, verification, and rollback. Written so an on-call engineer could follow them under stress.
6. `s6` **GUIDED BUILD PROJECTS** — 2-3 end-to-end mini-projects with complete working code the learner
   can actually run against the docker environment. Each project: what you'll build, architecture, full
   source, run instructions, and extension challenges.
7. `s7` **LAB COMPLETION** — a self-assessment checklist of capabilities, plus mark-done.

## Interactive elements (required)
- **Copy-to-clipboard on every code block.** Add a copy button to the `.codeblock` header that copies the
  block's text content. This is essential — the whole file is commands to run.
- A **command reference / cheatsheet** widget with filterable search.
- A **checklist widget** where the learner ticks off completed experiments, persisted in localStorage
  (key `sysinternals-lab-<course>`), with a progress ring.
- At least one **decision-tree or config-generator widget**: the learner answers questions about their
  workload and the widget emits a tuned config file they can copy.
- `stepper()` decks for multi-stage procedures where visualization helps.
- A terminal-styled output block class (monospace, dark, with a prompt) distinct from the input code blocks,
  so learners can tell "type this" from "you should see this".

## Hard rules
- Single self-contained HTML file. No frameworks, no CDN, no images.
- Dark mode only.
- Topbar back-link `<a href="index.html">← Hub</a>`.
- `#mark-done` writes `p["<file-id>"] = true` into localStorage key `sysinternals-progress-v1`
  (file-ids: `pg-lab`, `kafka-lab`, `wa-lab`).
- **Verify before finishing**: extract `<script>`, run `node --check` via bash
  (folder maps to `/sessions/*/mnt/outputs`). Confirm >90 KB. Grep every `el("...")` against real `id=`.
- **Commands must be correct.** Wrong flags or fictional tools destroy the file's value. Use only real
  tools with real syntax. Where a command's output varies, say so.
- Docker Compose files must be valid v2/v3 syntax with real, currently-published images.

## Tone
Direct and practical. Imperative voice for instructions. Senior-engineer register — no hand-holding about
what a terminal is, but complete precision about flags, paths, and expected results.
