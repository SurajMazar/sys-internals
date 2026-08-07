# SPEC — PostgreSQL Internals interactive course lessons

## Reference implementation
`pg-01.html` in this same folder is the CANONICAL TEMPLATE. **Read it first, in full.** Your chapter must be
indistinguishable from it in structure, CSS, and quality bar. Copy its entire `<style>` block verbatim (add
chapter-specific CSS at the end if you need new visual widgets). Copy its `<div id="topbar">`, `#toc`, hero,
`.lesson-end`, and the "CHROME" JS block (readbar, scrollspy, keys, mark-done) — changing only the chapter id/title/number.

## Audience
Senior → Staff/Principal engineers. They already know how to USE PostgreSQL. Teach **internal implementation only**.
No beginner material. Never write "PostgreSQL does X" — always say which process does it, which source file
implements it, which struct holds the data, which lock protects it, what the algorithm is, and why alternatives were rejected.

## Mandatory structure — 16 `<section>` elements, ids `s1`..`s16`
Same arc as pg-01, with `.arc` eyebrow labels:
1. `s1` THE PROBLEM — the concrete problem this subsystem solves
2. `s2` HISTORICAL CONTEXT — with an **interactive clickable timeline widget** (copy pg-01's TL pattern)
3. `s3` NAIVE SOLUTION — with a code block showing the strawman
4. `s4` WHY IT FAILS — quantified, with math where possible
5. `s5` BETTER SOLUTION — candidates examined and eliminated; include a **stepper deck**
6. `s6` WHY THAT STILL FAILS / COSTS
7. `s7` FINAL ARCHITECTURE — include an **interactive explorer widget** (clickable components → detail pane)
8. `s8` INTERNAL IMPLEMENTATION — the core. Real struct definitions, byte layouts, algorithms.
   Include at least one **stepper deck** and one **slider-driven widget**.
9. `s9` TRADEOFFS — comparison `table.cmp` against MySQL/InnoDB, Oracle, SQLite, RocksDB, Cassandra, etc. as relevant
10. `s10` PERFORMANCE CHARACTERISTICS — Big-O, cache/TLB/NUMA effects, disk access patterns, a **canvas chart widget**
11. `s11` REAL-WORLD PRODUCTION — 2-3 named incident walkthroughs with root cause and fix
12. `s12` INTERVIEW QUESTIONS — 6-7 reveal cards via `qaCards()`, levels SENIOR/STAFF/PRINCIPAL
13. `s13` SOURCE CODE WALKTHROUGH — `.ftree` file tree + 2-4 annotated `.codeblock`s of simplified-but-faithful
    real PostgreSQL C, plus a "why the developers wrote it this way" callout
14. `s14` QUIZ — 6 multiple-choice via the `QUIZ` array pattern (each wrong answer explained) + one
    sequencing/ordering challenge
15. `s15` SIMULATOR — the chapter's flagship interactive simulation (see per-chapter brief). Must expose live
    internal state and allow failure injection / parameter manipulation.
16. `s16` KNOWLEDGE CHECK — 3 `qaCards()` "THINK" questions with no options, that forward-reference the next chapter

## Reusable JS helpers to copy from pg-01
- `el(id)`, `stepper(rootId, steps)` — the deck engine (steps = `{stage, cap, onshow}`)
- `qaCards(rootId, items)` — reveal cards (`{lvl, q, hint, a}`)
- the `QUIZ` array + renderer, and the order-quiz pattern
- the scrollspy / readbar / keyboard / mark-done chrome block (set the localStorage key to your chapter id)

## Interactivity requirements
Every chapter needs, at minimum: 1 clickable timeline, 2+ stepper decks, 1 architecture/structure explorer,
2+ slider-driven live widgets, 1 canvas animation or chart, 1 quiz, 1 substantial simulator.
Prefer `<canvas>` or inline SVG over static markup for anything that moves. Animations should be requestAnimationFrame-driven and smooth.

## Hard rules
- **Single self-contained HTML file.** No external frameworks, no CDN, no images, no localStorage except the
  progress key. All CSS and JS inline.
- Dark mode only, using pg-01's CSS variables.
- Back-link `<a href="index.html">← Hub</a>` in the topbar.
- `.lesson-end` must have a `#mark-done` button writing `p["<your-chapter-id>"] = true` into
  localStorage key `sysinternals-progress-v1`.
- The "next chapter" button in `.lesson-end` should link to the next chapter's file (e.g. `pg-03.html`).
- **Verify before finishing**: extract your `<script>` contents and run `node --check` on them via the bash tool.
  Fix any syntax error. Also confirm the file is >100 KB (that's the depth bar) and has 16 sections.
- Technical accuracy is paramount. Use real function names, real file paths (`src/backend/...`), real struct
  fields, real GUC names, real PostgreSQL version history. If unsure of a detail, describe the mechanism
  accurately rather than inventing a specific identifier.
- Write in flowing technical prose. Avoid bullet-point soup; pg-01 uses `<p>` paragraphs heavily with occasional
  `ul.plain` lists.

## Tone
Confident, precise, first-principles. Explain WHY at every step. Derive, don't assert.
