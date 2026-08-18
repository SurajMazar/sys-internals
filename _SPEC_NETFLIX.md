# SPEC — Netflix Streaming & Content Delivery Internals (nflx-01…18)

## Your chapter's brief lives in `data/site.js`
Find your chapter id in the `COURSES` array (key `"nflx"`). Its `title`, `desc`, `tags`, and `sim` fields
are the authoritative brief — `desc` lists the topics you must cover, `sim` describes the flagship
simulator. Expand that brief into a full chapter; do not narrow it.

## What this course actually is
A focused course on **streaming and content delivery**, using Netflix's real, publicly-documented
engineering history as its case study — not a general "how Netflix's whole backend works" course. Three
arcs across the 18 chapters:

1. **Video & delivery internals** (nflx-01..08): why raw video must be compressed, codecs, adaptive
   bitrate streaming, per-title encoding, manifests/streaming protocols, Open Connect (Netflix's real CDN),
   and predictive content placement.
2. **Recommendations & personalization** (nflx-09..13): the recommendation problem, the real Netflix Prize
   and collaborative filtering, modern deep-learning ranking, UI-level personalization, and the
   experimentation platform that validates all of it.
3. **Keeping playback alive** (nflx-14..17): reliability patterns and chaos engineering *specifically in
   service of streaming reliability* (not a general microservices/backend-architecture course — stay
   scoped to why these techniques exist to keep the play button working), the device-certification problem
   across thousands of client types, and playback-quality observability.
4. **nflx-18** is the CAPSTONE, synthesizing encoding, delivery, and recommendation into one simulated
   end-to-end playback session.

## Reference implementation
`pg-01.html` is the CANONICAL TEMPLATE — read it in full. It currently ships light/dark theme support that
was injected by an **automated post-pass** (`_build_theme.py` / `_build_theme_fix2.py`), not hand-authored.
**Do NOT copy that injected machinery into your new file.** Concretely, when you copy the template's
`<style>` block and chrome, **omit these specific pieces** (they will be added to your file automatically,
correctly, after you're done, by the same scripts run across the whole site):
- The `<!-- THEME-EARLY -->` inline `<script>` right after `<head>`.
- The `/* THEME-LIGHT-OVERRIDE */` block (`html[data-theme="light"] { ... }`) and the `#theme-toggle` CSS
  next to it.
- The `/* THEME-TEXT-FIX-V2 */` marker and its `canvas{background:...!important}` rule.
- The `<!-- THEME-BTN -->` button + its click-handler `<script>` inside `#topbar`.

Do copy everything else verbatim: the base dark `:root` block (then change only the two accent variables
listed below), `#topbar`/`#toc`/`#readbar`, hero block, `.lesson-end`, and the JS helpers (`el`, `stepper`,
`qaCards`, the `QUIZ` array + renderer, the order-quiz, and the rest of the closing chrome block, minus the
theme-toggle script noted above). It's fine — expected, even — to also look at an already-built sibling
chapter in this same course (once one exists) to confirm you're matching the established in-course pattern
exactly.

⚠ **CRITICAL — do not reintroduce the light-mode text bug this site already fixed once.** The template's
prose/body-text color already reads `color:var(--body)` (never a hardcoded hex like `#c6cddb`) with
`--body:#c6cddb;` declared in `:root` as its dark-mode value. Keep that pattern in every rule you write or
copy — `<p>`, list items, callouts, table cells, quiz options, timeline/arch-detail panels, QA answers, file
trees, deck captions, etc. must all read their text color from `var(--body)`, `var(--text)`, or
`var(--muted)` — never a literal hex for anything that sits on a `var(--panel)`/`var(--bg)`/`var(--bg-2)`
background. Code blocks, the log console, and any `<canvas>` you draw on may keep a fixed dark background
(that's the established, intentional pattern for JS-drawn/syntax-highlighted content) — but nothing else.

Accent — change ONLY these two CSS variables:
- `--pg:#e50914;` and `--pg-dim:rgba(229,9,20,.12);` — Netflix's real brand red.

Topbar crumb: `NETFLIX STREAMING INTERNALS · <b>CH 0N / 18</b> · <SHORT NAME>`
Topbar back link: `course-netflix.html` with course name "Netflix Streaming Internals".

⚠ **Write all prose and all simulator JS fresh.** Sibling chapters have failed review for leaving another
course's content or JS behind. Every `el("...")` in your file must match a real `id=` in that same file, and
the file must contain zero PostgreSQL/Kafka/RabbitMQ/blockchain/Bitcoin/container/cryptography/Kubernetes/
Rust/Uber terms except in a deliberate, brief comparison sentence (e.g. Netflix's real data pipeline
(Keystone) runs on Kafka — one cross-reference sentence in whichever chapter mentions their data pipeline is
fine; do not otherwise re-derive Kafka internals — that's a full course elsewhere on this site).

## Accuracy and tone — this is the load-bearing rule for this course
Every chapter is built on **real, publicly-documented Netflix engineering history** — not invented lore.
Use real facts you're confident about: the 2007 pivot from DVD-by-mail to streaming, the real 2006-2009
Netflix Prize (the $1M open competition, the winning BellKor's Pragmatic Chaos ensemble, and the real,
often-told detail that the winning solution's complexity meant it was never fully put into production as-is
— a genuinely instructive lesson about engineering tradeoffs, not embarrassment), Open Connect as Netflix's
real purpose-built CDN with real Open Connect Appliances embedded inside ISP networks, per-title/per-shot
encoding as a real technique Netflix has published on, Chaos Monkey and the Simian Army as a real, famous,
Netflix-originated practice, and the real device-certification burden of supporting thousands of smart TVs
and set-top boxes. Where a precise present-day internal implementation detail isn't public (their current
exact recommendation model architecture, current exact caching hit-rate numbers), say so plainly and instead
teach the **general technique** the industry uses for this class of problem — never invent a specific fake
internal detail and present it as documented fact. Cite what's real as real; frame informed reconstruction
as reconstruction.

## Audience
Senior → Staff/Principal engineers. Teach **mechanism**, not "Netflix recommends shows you'll like"
hand-waving — say precisely what problem each component solves and how, with real math where it applies
(raw-video bitrate math motivating compression, RD-curve convex-hull logic behind per-title encoding, a real
matrix-factorization objective function, statistical-significance math for A/B tests). No hero-worship of
Netflix as a company; where real public nuance exists (the Netflix Prize's unused winning solution, chaos
engineering's real operational risk if done carelessly), state it neutrally.

## Mandatory structure — 16 `<section>` elements, ids `s1`..`s16`
1. `s1` THE PROBLEM  2. `s2` HISTORICAL CONTEXT (**interactive timeline widget** — real dated milestones:
   1997 founding as DVD-by-mail, 2007 streaming launch, 2006-2009 Netflix Prize, Open Connect's launch era,
   Chaos Monkey's real origin year, per-title encoding's publication — use whichever are relevant to that
   chapter's topic)
3. `s3` NAIVE SOLUTION (code block strawman — the simplest possible approach to this chapter's problem)
4. `s4` WHY IT FAILS (quantified, with math — real bitrate/scale numbers showing why the naive approach
   collapses at Netflix's actual scale: hundreds of millions of subscribers, thousands of device types)
5. `s5` BETTER SOLUTION (**stepper deck**)  6. `s6` WHY THAT STILL FAILS / COSTS
7. `s7` FINAL ARCHITECTURE (**interactive explorer widget**)
8. `s8` INTERNAL IMPLEMENTATION — the core: real data shapes/pseudocode/formulas where relevant. At least
   one **stepper deck** and one **slider-driven widget**.
9. `s9` TRADEOFFS — `table.cmp` comparing alternatives honestly
10. `s10` PERFORMANCE / SCALE CHARACTERISTICS — complexity, real scaling numbers, a **canvas chart**
11. `s11` REAL-WORLD INCIDENTS / HISTORY — named, real, publicly-documented events with honest analysis (the
    Netflix Prize's unused winner, a real documented outage if applicable, or — if nothing chapter-specific
    is public — a realistic industry-standard incident pattern for this class of system, stated as such)
12. `s12` INTERVIEW QUESTIONS — 6-7 `qaCards()`, SENIOR/STAFF/PRINCIPAL
13. `s13` CODE WALKTHROUGH — `.ftree` module/service tree + 2-4 annotated `.codeblock`s (precise reference
    pseudocode representative of how a system like this is actually built — labeled as illustrative where
    the real internal source isn't public), plus a "why it was built this way" callout
14. `s14` QUIZ — 6 multiple-choice (each wrong answer explained) + one ordering challenge
15. `s15` SIMULATOR — the flagship interactive simulation from your `sim` field
16. `s16` KNOWLEDGE CHECK — 3 `qaCards()` "THINK" questions forward-referencing the next chapter (the final
    chapter, nflx-18, should instead ask reflective/synthesis questions about the whole course)

## Interactivity
Minimum: 1 clickable timeline, 2+ stepper decks, 1 explorer, 2+ slider widgets, 1 canvas animation/chart,
quiz + order quiz, 1 substantial simulator. Prefer `<canvas>`/SVG for anything that moves;
requestAnimationFrame; 60fps. Bitrate-ladder switching under simulated network jitter, rate-distortion
curves, CDN cache-hit heatmaps, matrix factorization converging, and A/B test result distributions are all
excellent candidates for animation.

**Make simulated math genuinely computed, not decorative.** If you show an ABR algorithm switching quality,
it must react to an actually-varying simulated bandwidth/buffer signal; if you show per-title encoding
savings, the bitrate numbers must come from a real (simplified) rate-distortion tradeoff, not a fixed
percentage; if you show a recommendation ranking, it must be computed from the stated user/item signals.

## Hard rules
- Single self-contained HTML file. No frameworks, no CDN, no images, no localStorage except the progress
  key.
- Both dark and light mode must work (copy the template's already-fixed theme system verbatim — see the
  CRITICAL note above about `var(--body)`).
- `.lesson-end` `#mark-done` writes `p["<chapter-id>"] = true` into `sysinternals-progress-v1`.
- Next-chapter button links to the next file. Final chapter (nflx-18) links back to `index.html` reading
  "← Course complete · Back to hub".
- **Verify before finishing**: extract the `<script>`, run `node --check` via bash; confirm exactly 16
  sections, >100 KB, file ends with `</html>`, every `el("...")` resolves, zero cross-course contamination,
  zero hardcoded hex colors used as `color:` on prose/list/table/quiz text (grep for `color:#` outside the
  known-safe codeblock/canvas contexts and confirm every hit is one of the established syntax-highlight
  colors on a fixed-dark background, not a var(--body) regression).

## Tone
Confident, precise, first-principles. Derive, don't assert. Flowing prose in `<p>` paragraphs with
occasional `ul.plain` lists — not bullet soup.
