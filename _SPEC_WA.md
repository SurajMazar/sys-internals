# SPEC — WhatsApp Architecture interactive course lessons (Course 04, chapters wa-01 … wa-12)

## Reference implementation
`pg-01.html` in this same folder is the CANONICAL TEMPLATE. **Read it first, in full.** Your chapter must be
indistinguishable from it in structure, CSS quality, and depth. Copy its entire `<style>` block, then change
ONLY the accent variable: replace `--pg:#60a5fa` usage with the WhatsApp course accent **`#4ade80`** (green).
Concretely: keep the variable names identical but set `--pg:#4ade80;` and `--pg-dim:rgba(74,222,128,.12);`
and change the hero gradient to green→teal. Everything else stays byte-identical so the courses feel like one product.

Copy verbatim: the `#topbar`, `#toc`, `#readbar`, hero block, `.lesson-end`, and the JS helpers
`el()`, `stepper()`, `qaCards()`, the `QUIZ` array + renderer, the order-quiz, and the closing chrome block
(readbar, scrollspy, keyboard nav, mark-done).

Topbar crumb format: `WHATSAPP ARCHITECTURE · <b>CH 0N / 12</b> · <SHORT NAME>`

## Audience
Senior → Staff/Principal engineers. Teach **internal mechanism and design derivation**, never product features.
No beginner material. Never write "WhatsApp does X" — say which layer/process performs it, what the wire message
looks like, what the data structure is, what the failure mode is, what the alternative designs were and why they lose.
Where exact internals are not public, say so explicitly and reason from the published record (engineering blog posts,
the Signal protocol specs, WhatsApp's own security whitepaper, Erlang Factory / Code BEAM talks, court-disclosed
architecture details) plus first-principles derivation. **Label speculation as speculation** — a Staff engineer
respects the distinction between "documented" and "the only design that could work at this scale."

## Mandatory structure — 16 `<section>` elements, ids `s1`..`s16`
1. `s1` THE PROBLEM
2. `s2` HISTORICAL CONTEXT — with an **interactive clickable timeline widget**
3. `s3` NAIVE SOLUTION — with a code block showing the strawman
4. `s4` WHY IT FAILS — quantified, with math
5. `s5` BETTER SOLUTION — candidates examined and eliminated; include a **stepper deck**
6. `s6` WHY THAT STILL FAILS / COSTS
7. `s7` FINAL ARCHITECTURE — include an **interactive explorer widget** (clickable components → detail pane)
8. `s8` INTERNAL IMPLEMENTATION — the core. Wire formats, state machines, data structures, algorithms.
   At least one **stepper deck** and one **slider-driven widget**.
9. `s9` TRADEOFFS — comparison `table.cmp` against Signal, iMessage, Telegram, Messenger, Slack, XMPP, Matrix, Discord as relevant
10. `s10` PERFORMANCE CHARACTERISTICS — Big-O, memory/CPU per connection, network round trips, battery/radio cost on mobile, a **canvas chart widget**
11. `s11` REAL-WORLD PRODUCTION — named incidents/outages, published numbers, scaling milestones
12. `s12` INTERVIEW QUESTIONS — 6-7 reveal cards via `qaCards()`, levels SENIOR/STAFF/PRINCIPAL.
    These should read like real system-design interview questions at FAANG level.
13. `s13` IMPLEMENTATION WALKTHROUGH — instead of a C source tree, show: protocol message layouts, pseudo-code
    or real Erlang/Go/TypeScript/Python for the key algorithm, state machines, and (where relevant) the actual
    published Signal protocol primitives. Use `.ftree` for module/service structure and 2-4 annotated `.codeblock`s.
    Include a "why the engineers chose this" callout.
14. `s14` QUIZ — 6 multiple-choice (each wrong answer explained) + one sequencing/ordering challenge
15. `s15` SIMULATOR — the chapter's flagship interactive simulation. Must expose live internal state and allow
    failure injection / parameter manipulation.
16. `s16` KNOWLEDGE CHECK — 3 `qaCards()` "THINK" questions, no options, forward-referencing the next chapter

## Interactivity requirements
Minimum per chapter: 1 clickable timeline, 2+ stepper decks, 1 architecture explorer, 2+ slider-driven live
widgets, 1 canvas animation or chart, 1 quiz + order quiz, 1 substantial simulator.
Prefer `<canvas>` or inline SVG for anything that moves. Use requestAnimationFrame; target smooth 60fps.
Message/packet flow animations are especially appropriate for this course — show messages travelling between
phones, servers, and queues.

## Hard rules
- **Single self-contained HTML file.** No frameworks, no CDN, no images, no localStorage except the progress key.
- Dark mode only.
- Topbar back-link `<a href="index.html">← Hub</a>`.
- `.lesson-end` `#mark-done` button writes `p["<chapter-id>"] = true` into localStorage key `sysinternals-progress-v1`.
- The "next chapter" button links to the next file (e.g. `wa-03.html`). For wa-12, link back to `index.html`
  reading "← Course complete · Back to hub".
- **Verify before finishing**: extract the `<script>` block and run `node --check` via bash
  (the folder maps to `/sessions/*/mnt/outputs`). Fix syntax errors. Confirm 16 sections and >100 KB.
- Accuracy matters. Real numbers (2M connections/server, 50 engineers, 900M users at acquisition, 100B
  messages/day), real protocol names (X3DH, Double Ratchet, FunXMPP, Noise Pipes), real technologies
  (Erlang/OTP, FreeBSD, Mnesia, ejabberd fork, BEAM, kqueue). Do not invent internal service names that were
  never published — describe roles instead.

## Tone
Confident, precise, first-principles. Explain WHY at every step. Derive, don't assert. Flowing technical prose
in `<p>` paragraphs with occasional `ul.plain` lists — not bullet soup.
