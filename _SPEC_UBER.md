# SPEC — Uber Engineering Internals (uber-01…18)

## Your chapter's brief lives in `data/site.js`
Find your chapter id in the `COURSES` array (key `"uber"`). Its `title`, `desc`, `tags`, and `sim` fields
are the authoritative brief — `desc` lists the topics you must cover, `sim` describes the flagship
simulator. Expand that brief into a full chapter; do not narrow it.

## What this course actually is
Not a "how to use the Uber app" course. It is a systems-internals course that uses Uber's real,
publicly-documented engineering history as its case study, covering three arcs across the 18 chapters:

1. **Ride-hailing systems internals** (uber-01..07): the marketplace-matching problem, geospatial
   indexing (H3), real-time location ingestion, dispatch/matching algorithms, ETA & routing, surge
   pricing, and trip-lifecycle state machines.
2. **Backend architecture at scale** (uber-08..13): the monolith-to-microservices migration, RPC/service
   mesh, the Kafka-based event backbone, observability (M3, Jaeger — both of which Uber actually built and
   open-sourced), deployment/scheduling infra (Peloton), and the mobile API gateway.
3. **Database evolution** (uber-14..17): the real, well-documented 2016 "why Uber engineering switched
   from Postgres to MySQL" story, Schemaless (sharded MySQL as a scalable KV store), Docstore (the
   MyRocks-based successor), and sharding/multi-region strategy.
4. **uber-18** is the CAPSTONE, synthesizing all three arcs into one simulated end-to-end request.

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
theme-toggle script noted above).

⚠ **CRITICAL — do not reintroduce the light-mode text bug this site already fixed once.** The template's
prose/body-text color already reads `color:var(--body)` (never a hardcoded hex like `#c6cddb`) with
`--body:#c6cddb;` declared in `:root` as its dark-mode value. Keep that pattern in every rule you write or
copy — `<p>`, list items, callouts, table cells, quiz options, timeline/arch-detail panels, QA answers, file
trees, deck captions, etc. must all read their text color from `var(--body)`, `var(--text)`, or
`var(--muted)` — never a literal hex for anything that sits on a `var(--panel)`/`var(--bg)`/`var(--bg-2)`
background. Code blocks, the log console, and any `<canvas>` you draw on may keep a fixed dark background
(that's the established, intentional pattern for JS-drawn/syntax-highlighted content) — but nothing else.

Accent — change ONLY these two CSS variables:
- `--pg:#06c167;` and `--pg-dim:rgba(6,193,103,.12);` — Uber's real brand green.

Topbar crumb: `UBER ENGINEERING INTERNALS · <b>CH 0N / 18</b> · <SHORT NAME>`
Topbar back link: `course-uber.html` with course name "Uber Engineering Internals".

⚠ **Write all prose and all simulator JS fresh.** Sibling chapters have failed review for leaving another
course's content or JS behind. Every `el("...")` in your file must match a real `id=` in that same file, and
the file must contain zero PostgreSQL/Kafka/RabbitMQ/blockchain/Bitcoin/container/cryptography/Kubernetes/
Rust terms except in a deliberate, brief comparison sentence (e.g. one sentence noting Uber's event
backbone runs on Kafka is fine and expected in the uber-10 chapter specifically; do not otherwise re-derive
Kafka internals — that's a full course elsewhere on this site).

## Accuracy and tone — this is the load-bearing rule for this course
Every chapter is built on **real, publicly-documented Uber engineering history** — not invented lore. Use
real facts you're confident about: the 2016 Uber Engineering blog post "Why Uber Engineering Switched from
Postgres to MySQL" (and that it was publicly debated/pushed back on by parts of the Postgres community —
present both sides fairly, don't editorialize that either side was simply right), Schemaless as a
sharded-MySQL-backed datastore, Docstore as a MyRocks/RocksDB-based successor with secondary indexes and
multi-region replication, H3 as Uber's real open-sourced hexagonal hierarchical geospatial index, M3 as
Uber's real open-sourced metrics platform (built because Prometheus-era tooling didn't handle their metric
cardinality), Jaeger as Uber's real open-sourced distributed tracing system (donated to CNCF), and Peloton
as Uber's real Mesos-based unified scheduler for mixing stateless services with batch/ML workloads. Where a
precise internal implementation detail isn't public knowledge, say so plainly and instead teach the
**general distributed-systems technique** any company at that scale would need (e.g. "the exact matching
algorithm Uber runs today isn't public; here is the general bipartite-matching / batching technique this
class of problem requires, and the tradeoffs it forces") — never invent a specific fake internal detail and
present it as documented fact. Cite what's real as real; frame informed reconstruction as reconstruction.

## Audience
Senior → Staff/Principal engineers. Teach **mechanism**, not "Uber has an app that matches riders and
drivers" hand-waving — say precisely what problem each component solves and how, with real math where it
applies (H3 resolution-to-cell-area table, surge-multiplier formula shape, HPA-style supply/demand ratios,
sharding key design). No hero-worship of Uber as a company and no gratuitous criticism either — where real
public controversy exists (surge pricing during emergencies, the Postgres-to-MySQL post's reception), state
it neutrally and let the reader weigh it.

## Mandatory structure — 16 `<section>` elements, ids `s1`..`s16`
1. `s1` THE PROBLEM  2. `s2` HISTORICAL CONTEXT (**interactive timeline widget** — real dated milestones:
   2009 founding as UberCab, 2010 SF launch, 2014-15 microservices migration era, 2016 Postgres→MySQL post,
   H3/M3/Jaeger open-source releases, etc. — use the real years for whichever milestones are relevant to
   that chapter's topic)
3. `s3` NAIVE SOLUTION (code block strawman showing the simplest possible approach to this chapter's
   problem)  4. `s4` WHY IT FAILS (quantified, with math — e.g. real Big-O or throughput math showing why
   the naive approach collapses at Uber's actual scale: millions of trips/day, thousands of cities)
5. `s5` BETTER SOLUTION (**stepper deck**)  6. `s6` WHY THAT STILL FAILS / COSTS
7. `s7` FINAL ARCHITECTURE (**interactive explorer widget**)
8. `s8` INTERNAL IMPLEMENTATION — the core: real data shapes/pseudocode/formulas where relevant. At least
   one **stepper deck** and one **slider-driven widget**.
9. `s9` TRADEOFFS — `table.cmp` comparing alternatives honestly
10. `s10` PERFORMANCE / SCALE CHARACTERISTICS — complexity, real scaling numbers, a **canvas chart**
11. `s11` REAL-WORLD INCIDENTS / CONTROVERSIES — named, real, publicly-documented events with honest
    analysis (surge-pricing backlash episodes, real outages if publicly documented, the Postgres-to-MySQL
    debate, etc. — scoped to what's actually documented; if nothing chapter-specific is public, use a
    realistic industry-standard incident pattern for this class of system and say so)
12. `s12` INTERVIEW QUESTIONS — 6-7 `qaCards()`, SENIOR/STAFF/PRINCIPAL
13. `s13` CODE WALKTHROUGH — `.ftree` module/service tree + 2-4 annotated `.codeblock`s (precise reference
    pseudocode representative of how a system like this is actually built — labeled as illustrative where
    the real internal source isn't public), plus a "why it was built this way" callout
14. `s14` QUIZ — 6 multiple-choice (each wrong answer explained) + one ordering challenge
15. `s15` SIMULATOR — the flagship interactive simulation from your `sim` field
16. `s16` KNOWLEDGE CHECK — 3 `qaCards()` "THINK" questions forward-referencing the next chapter (the
    final chapter, uber-18, should instead ask reflective/synthesis questions about the whole course)

## Interactivity
Minimum: 1 clickable timeline, 2+ stepper decks, 1 explorer, 2+ slider widgets, 1 canvas animation/chart,
quiz + order quiz, 1 substantial simulator. Prefer `<canvas>`/SVG for anything that moves;
requestAnimationFrame; 60fps. Geo-hex grids, dispatch matching, ETA/routing, surge heatmaps, reconciliation
loops, distributed tracing spans, and replication topologies are all excellent candidates for animation.

**Make simulated math genuinely computed, not decorative.** If you show a surge multiplier, it must be
computed from the stated supply/demand inputs with a real formula; if you show H3 cell resolution, the
cell-count-per-area math must be real; if you show a matching algorithm, the assignment must actually
respect the stated constraints (no double-booking a driver, no assigning further than the stated radius).

## Hard rules
- Single self-contained HTML file. No frameworks, no CDN, no images, no localStorage except the progress
  key.
- Both dark and light mode must work (copy the template's already-fixed theme system verbatim — see the
  CRITICAL note above about `var(--body)`).
- `.lesson-end` `#mark-done` writes `p["<chapter-id>"] = true` into `sysinternals-progress-v1`.
- Next-chapter button links to the next file. Final chapter (uber-18) links back to `index.html` reading
  "← Course complete · Back to hub".
- **Verify before finishing**: extract the `<script>`, run `node --check` via bash; confirm exactly 16
  sections, >100 KB, file ends with `</html>`, every `el("...")` resolves, zero cross-course contamination,
  zero hardcoded hex colors used as `color:` on prose/list/table/quiz text (grep for `color:#` outside the
  known-safe codeblock/canvas contexts and confirm every hit is one of the established syntax-highlight
  colors on a fixed-dark background, not a var(--body) regression).

## Tone
Confident, precise, first-principles. Derive, don't assert. Flowing prose in `<p>` paragraphs with
occasional `ul.plain` lists — not bullet soup.
