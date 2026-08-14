# SPEC — Rust: Beginner to Advanced, with Tauri (rust-01…22)

## This is a FULL LANGUAGE COURSE, not a narrow internals-only deep-dive
Unlike this site's other courses (which assume the reader already knows the target system and want its
internals), the Rust course must teach the language itself, comprehensively, beginner through advanced —
syntax, ownership, the type system, error handling, collections, concurrency, async, unsafe, macros — AND
still go deep on mechanism wherever the site's format rewards it (why the borrow checker rejects a specific
pattern, what monomorphization actually generates, how async desugars to a state machine). Do not skip
"how do I actually write this" in favor of only "why does this exist" — a genuine beginner chapter (rust-01
through rust-07) must leave the reader able to write and run real working code, not just understand a
concept abstractly.

## Your chapter's brief lives in `data/site.js`
Find your chapter id in the `COURSES` array (key `"rust"`). Its `title`, `desc`, `tags`, and `sim` fields
are the authoritative brief — `desc` lists the topics you must cover, `sim` describes the flagship
simulator. Expand that brief into a full chapter; do not narrow it.

## Tiers
rust-01 through rust-07 are BEGINNER: assume no prior Rust exposure, though the reader has programmed in
some other language. Define every term the first time it's used. rust-08 through rust-14 are INTERMEDIATE.
rust-15 through rust-20 are ADVANCED: assume the first two tiers were read. rust-21 and rust-22 are the
TAURI arc (rust-21 architecture, rust-22 capstone). Put a small tier badge in the hero (BEGINNER /
INTERMEDIATE / ADVANCED / TAURI / CAPSTONE) so the reader always knows where they are.

## Reference implementation
`pg-01.html` is the CANONICAL TEMPLATE — read it in full. Copy its entire `<style>` block, its `<head>`
favicon/theme-color links, `#topbar`, `#toc`, `#readbar`, hero block, `.lesson-end`, and its JS helpers
(`el`, `stepper`, `qaCards`, the `QUIZ` array + renderer, the order-quiz, and the closing chrome block).

Accent — change ONLY these two CSS variables:
- `--pg:#ce422b;` and `--pg-dim:rgba(206,66,43,.12);` — Rust's real brand burnt-orange, hero gradient
  orange→amber.

Topbar crumb: `RUST · <b>CH 0N / 22</b> · <SHORT NAME>`
Topbar back link: `course-rust.html` with course name "Rust: Beginner to Advanced".

⚠ **Write all prose and all simulator JS fresh.** Sibling chapters have failed review for leaving another
course's content or JS behind. Every `el("...")` in your file must match a real `id=` in that same file, and
the file must contain zero PostgreSQL/Kafka/RabbitMQ/blockchain/Bitcoin/container/cryptography/Kubernetes
terms except in a deliberate, brief comparison sentence.

## Real, runnable code is mandatory
Every code example shown as "this compiles" or "this is idiomatic" must be code that would actually compile
under a real, current-stable Rust toolchain — check borrow-checker rules, trait bound syntax, and macro
syntax carefully. Every code example shown as "this fails to compile" must fail for the exact stated reason
(cite the real rustc error code where one exists, e.g. E0502, E0499, E0382) — do not invent an error that
isn't what rustc would actually say. Where a `<canvas>`/JS simulator claims to model borrow-checker behavior
(e.g. an ownership/borrow visualizer), the underlying JS state machine must implement the real rule (one
mutable XOR many immutable borrows, non-lexical lifetimes ending a borrow at last use not end of scope) so
that valid/invalid determinations are genuinely computed, not scripted per example.

## Reference implementation
`pg-01.html` remains the CSS/chrome template as in every other course on this site (see above) — the code
examples themselves should use `<pre class="codeblock">` blocks with real Rust syntax highighting-free text
(this site doesn't ship a syntax highlighter; format for readability with clear indentation and comments).

## Mandatory structure — 16 `<section>` elements, ids `s1`..`s16`
1. `s1` THE PROBLEM  2. `s2` HISTORICAL CONTEXT (**interactive timeline widget** — for beginner chapters
   this can be Rust's own project history; for concept chapters it's the concept's history, e.g. affine
   types in academic type theory before Rust, or the async ecosystem's pre-1.0 churn)
3. `s3` NAIVE SOLUTION (a real, compiling-or-deliberately-not-compiling code strawman in another language
   or in incorrect Rust)  4. `s4` WHY IT FAILS (quantified — a real bug class, a real CVE class like a
   C use-after-free, or a real rustc error)
5. `s5` BETTER SOLUTION (**stepper deck** walking to the idiomatic Rust approach)
6. `s6` WHY THAT STILL HAS COSTS (be honest — verbosity, compile times, learning curve, what Rust doesn't
   solve)
7. `s7` FINAL ARCHITECTURE / MENTAL MODEL (**interactive explorer widget**)
8. `s8` INTERNAL IMPLEMENTATION — for language-feature chapters: what the compiler actually does
   (monomorphization, vtable layout, state-machine desugaring, MIR shape). For beginner syntax chapters:
   real worked code examples building in complexity. At least one **stepper deck** and one
   **slider-driven widget**.
9. `s9` TRADEOFFS — `table.cmp` comparing alternatives honestly (vs C++, vs Go, vs GC'd languages, or
   between two Rust approaches to the same problem)
10. `s10` PERFORMANCE / SAFETY CHARACTERISTICS — real benchmarks/complexity claims, a **canvas chart**
11. `s11` REAL-WORLD INCIDENTS OR CASE STUDIES — named production stories (a real CVE prevented by the
    borrow checker, a real async footgun postmortem, a real unsafe-Rust CVE like a `Vec` capacity bug)
12. `s12` INTERVIEW QUESTIONS — 6-7 `qaCards()`, JUNIOR/MID/SENIOR framing for beginner-tier chapters,
    SENIOR/STAFF/PRINCIPAL for advanced-tier
13. `s13` CODE WALKTHROUGH — `.ftree` module tree + 2-4 annotated `.codeblock`s (real std library source
    shape, or a real crate's source shape — e.g. `tokio`, `serde`, `rayon` — cited accurately)
14. `s14` QUIZ — 6 multiple-choice (each wrong answer explained) + one ordering challenge
15. `s15` SIMULATOR — the flagship interactive simulation from your `sim` field
16. `s16` KNOWLEDGE CHECK — 3 `qaCards()` "THINK" questions forward-referencing the next chapter (rust-22,
    the final chapter, should instead ask reflective/synthesis questions about the whole course)

## Interactivity
Minimum: 1 clickable timeline, 2+ stepper decks, 1 explorer, 2+ slider widgets, 1 canvas animation/chart,
quiz + order quiz, 1 substantial simulator. Prefer `<canvas>`/SVG for anything that moves;
requestAnimationFrame; 60fps. Ownership moves, borrow-checker scope analysis, monomorphization, async
state-machine transitions, and macro expansion are all excellent candidates for animation and MUST be
genuinely computed against the stated rules (see "Real, runnable code is mandatory" above), not scripted.

## Hard rules
- Single self-contained HTML file. No frameworks, no CDN, no images, no localStorage except the progress key.
- Dark mode only. `.lesson-end` `#mark-done` writes `p["<chapter-id>"] = true` into `sysinternals-progress-v1`.
- Next-chapter button links to the next file. Final chapter (rust-22) links back to `index.html`
  reading "← Course complete · Back to hub".
- **Verify before finishing**: extract the `<script>`, run `node --check` via bash; confirm exactly 16
  sections, >100 KB, file ends with `</html>`, every `el("...")` resolves, zero cross-course contamination.

## Tone
Confident, precise, first-principles. Derive, don't assert. Flowing prose in `<p>` paragraphs with
occasional `ul.plain` lists — not bullet soup. Beginner chapters must be precise and complete, never
condescending, but also must not assume prior Rust knowledge — every acronym and keyword gets defined
on first use.
