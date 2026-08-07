# SPEC — Blockchain Fundamentals (bc-01…14) & Bitcoin Internals (btc-01…16)

## Your chapter's brief lives in `data/site.js`
Find your chapter id in the `COURSES` array. Its `title`, `desc`, `tags`, and `sim` fields are the
authoritative brief — `desc` lists the topics you must cover, `sim` describes the flagship simulator.
Expand that brief into a full chapter; do not narrow it.

## Reference implementation
`pg-01.html` is the CANONICAL TEMPLATE — read it in full. Copy its entire `<style>` block, its `<head>`
favicon/theme-color links, `#topbar`, `#toc`, `#readbar`, hero block, `.lesson-end`, and its JS helpers
(`el`, `stepper`, `qaCards`, the `QUIZ` array + renderer, the order-quiz, and the closing chrome block).

Accent — change ONLY these two CSS variables:
- Blockchain (`bc-*`): `--pg:#a78bfa;` and `--pg-dim:rgba(167,139,250,.12);` — hero gradient purple→indigo
- Bitcoin (`btc-*`): `--pg:#f7931a;` and `--pg-dim:rgba(247,147,26,.12);` — hero gradient orange→gold

Topbar crumb: `BLOCKCHAIN FUNDAMENTALS · <b>CH 0N / 14</b> · <SHORT NAME>`
              `BITCOIN INTERNALS · <b>CH 0N / 16</b> · <SHORT NAME>`
Topbar back link: `course-blockchain.html` / `course-bitcoin.html` with the course name.

⚠ **Write all prose and all simulator JS fresh.** Sibling chapters have failed review for leaving another
course's content or JS behind. Every `el("...")` in your file must match a real `id=` in that same file, and
the file must contain zero PostgreSQL/Kafka/RabbitMQ terms except in a deliberate comparison sentence.

## Audience
Senior → Staff/Principal engineers. Assume strong systems background, no prior blockchain knowledge.
Teach **mechanism**, not hype. Never write "the blockchain is immutable" — say what actually happens
(rewriting requires redoing the work, so immutability is economic, not mathematical). No price talk, no
investment framing, no boosterism. Where something is genuinely disputed or unresolved, say so.

Be precise with numbers and cite real artifacts: BIP numbers, CVE ids, block heights, opcode names,
byte offsets, real curve parameters, real papers (Nakamoto 2008, Eyal & Sirer on selfish mining,
Heilman et al. on eclipse attacks, Cahill/Lamport for the classical results).

## Mandatory structure — 16 `<section>` elements, ids `s1`..`s16`
1. `s1` THE PROBLEM  2. `s2` HISTORICAL CONTEXT (**interactive timeline widget**)
3. `s3` NAIVE SOLUTION (code block strawman)  4. `s4` WHY IT FAILS (quantified, with math)
5. `s5` BETTER SOLUTION (**stepper deck**)  6. `s6` WHY THAT STILL FAILS / COSTS
7. `s7` FINAL ARCHITECTURE (**interactive explorer widget**)
8. `s8` INTERNAL IMPLEMENTATION — the core: byte layouts, algorithms, state machines.
   At least one **stepper deck** and one **slider-driven widget**.
9. `s9` TRADEOFFS — `table.cmp` comparing alternatives honestly
10. `s10` PERFORMANCE / SECURITY CHARACTERISTICS — complexity, attack cost, bandwidth, a **canvas chart**
11. `s11` REAL-WORLD INCIDENTS — named events with root-cause analysis
12. `s12` INTERVIEW QUESTIONS — 6-7 `qaCards()`, SENIOR/STAFF/PRINCIPAL
13. `s13` CODE WALKTHROUGH — `.ftree` module tree + 2-4 annotated `.codeblock`s (Bitcoin Core C++ for
    `btc-*`, or reference pseudo-code/Python for `bc-*`), plus a "why it was built this way" callout
14. `s14` QUIZ — 6 multiple-choice (each wrong answer explained) + one ordering challenge
15. `s15` SIMULATOR — the flagship interactive simulation from your `sim` field
16. `s16` KNOWLEDGE CHECK — 3 `qaCards()` "THINK" questions forward-referencing the next chapter

## Interactivity
Minimum: 1 clickable timeline, 2+ stepper decks, 1 explorer, 2+ slider widgets, 1 canvas animation/chart,
quiz + order quiz, 1 substantial simulator. Prefer `<canvas>`/SVG for anything that moves;
requestAnimationFrame; 60fps. Hash grinding, curve point addition, Merkle proofs, block propagation,
fork races, and script execution are all excellent candidates for animation.

**Where you show cryptography, make it real.** Implement SHA-256, Merkle trees, and modular/curve
arithmetic in JS so the simulator computes genuine values rather than fake-looking hex. BigInt is available.

## Hard rules
- Single self-contained HTML file. No frameworks, no CDN, no images, no localStorage except the progress key.
- Dark mode only. `.lesson-end` `#mark-done` writes `p["<chapter-id>"] = true` into `sysinternals-progress-v1`.
- Next-chapter button links to the next file. Final chapter of each course links back to `index.html`
  reading "← Course complete · Back to hub".
- **Verify before finishing**: extract the `<script>`, run `node --check` via bash; confirm exactly 16
  sections, >100 KB, file ends with `</html>`, every `el("...")` resolves, zero cross-course contamination.

## Tone
Confident, precise, first-principles. Derive, don't assert. Flowing prose in `<p>` paragraphs with
occasional `ul.plain` lists — not bullet soup.
