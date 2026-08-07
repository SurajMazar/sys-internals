# SPEC — RabbitMQ Internals interactive course (Course 03, chapters rmq-01 … rmq-12)

## Reference implementation
`pg-01.html` in this folder is the CANONICAL TEMPLATE. **Read it first, in full.** Your chapter must be
indistinguishable from it in structure, CSS quality, and depth. Copy its entire `<style>` block, then change
ONLY the accent: set `--pg:#ff9f43;` and `--pg-dim:rgba(255,159,67,.12);` (RabbitMQ orange) and make the hero
gradient orange→amber. Everything else stays identical so all courses feel like one product.

Copy verbatim: the `<head>` favicon links (see any existing chapter), `#topbar`, `#toc`, `#readbar`, hero block,
`.lesson-end`, and the JS helpers `el()`, `stepper()`, `qaCards()`, the `QUIZ` array + renderer, the order-quiz,
and the closing chrome block (readbar, scrollspy, keyboard nav, mark-done).

Topbar crumb: `RABBITMQ INTERNALS · <b>CH 0N / 12</b> · <SHORT NAME>`
Topbar back link: `<a class="back" href="course-rabbitmq.html">← RabbitMQ Internals</a>`

Other complete examples to skim for conventions: `kafka-05.html`, `pg-09.html`, `pg-21.html` (capstone shape).

## Audience
Senior → Staff/Principal engineers who already USE RabbitMQ. Teach **internal implementation only**.
Never write "RabbitMQ does X" — say which Erlang process does it, which module implements it, which ETS table
or Mnesia/Khepri record holds the state, what the algorithm is, its complexity, and which alternatives were
rejected. Reference real modules (`rabbit_channel`, `rabbit_amqqueue_process`, `rabbit_reader`, `rabbit_writer`,
`rabbit_exchange_type_topic`, `rabbit_msg_store`, `rabbit_queue_index`, `rabbit_variable_queue`, `rabbit_fifo`,
`ra`, `rabbit_stream_queue`) and real config keys (`vm_memory_high_watermark`, `disk_free_limit`,
`queue_master_locator`, `x-max-length`, `x-message-ttl`, `x-delivery-limit`, `prefetch_count`,
`cluster_partition_handling`).

## Mandatory structure — 16 `<section>` elements, ids `s1`..`s16`
1. `s1` THE PROBLEM
2. `s2` HISTORICAL CONTEXT — **interactive clickable timeline widget**
3. `s3` NAIVE SOLUTION — code block showing the strawman
4. `s4` WHY IT FAILS — quantified, with math
5. `s5` BETTER SOLUTION — candidates examined and eliminated; **stepper deck**
6. `s6` WHY THAT STILL FAILS / COSTS
7. `s7` FINAL ARCHITECTURE — **interactive explorer widget** (clickable components → detail pane)
8. `s8` INTERNAL IMPLEMENTATION — the core. Message/frame layouts, process state machines, algorithms.
   At least one **stepper deck** and one **slider-driven widget**.
9. `s9` TRADEOFFS — `table.cmp` comparing against Kafka, Pulsar, NATS/JetStream, SQS, ActiveMQ, Redis Streams,
   and plain AMQP brokers as relevant
10. `s10` PERFORMANCE CHARACTERISTICS — Big-O, per-process memory, BEAM scheduling, disk access patterns,
    message rates, a **canvas chart widget**
11. `s11` REAL-WORLD PRODUCTION — named incidents, published numbers, postmortems
12. `s12` INTERVIEW QUESTIONS — 6-7 `qaCards()`, levels SENIOR/STAFF/PRINCIPAL
13. `s13` SOURCE CODE WALKTHROUGH — `.ftree` module tree + 2-4 annotated `.codeblock`s of simplified-but-faithful
    Erlang, plus a "why the developers wrote it this way" callout
14. `s14` QUIZ — 6 multiple-choice (each wrong answer explained) + one sequencing/ordering challenge
15. `s15` SIMULATOR — the chapter's flagship interactive simulation, exposing live internal state with
    failure injection / parameter manipulation
16. `s16` KNOWLEDGE CHECK — 3 `qaCards()` "THINK" questions, no options, forward-referencing the next chapter

## Interactivity requirements
Per chapter minimum: 1 clickable timeline, 2+ stepper decks, 1 architecture explorer, 2+ slider-driven live
widgets, 1 canvas animation or chart, 1 quiz + order quiz, 1 substantial simulator. Prefer `<canvas>`/SVG for
anything that moves; requestAnimationFrame; smooth 60fps. Message-routing, queue-depth, credit-flow, and Raft
replication animations are especially appropriate for this course.

## Hard rules
- **Single self-contained HTML file.** No frameworks, no CDN, no images, no localStorage except the progress key.
- Dark mode only.
- `.lesson-end` `#mark-done` writes `p["<chapter-id>"] = true` into localStorage key `sysinternals-progress-v1`.
- "Next chapter" button links to the next file (e.g. `rmq-03.html`). For rmq-12, link back to `index.html`
  reading "← Course complete · Back to hub".
- **Verify before finishing**: extract the `<script>` block, run `node --check` via bash. Fix syntax errors.
  Confirm exactly 16 sections and >100 KB. Grep every `el("...")` against actual `id=` attributes.
- Accuracy matters. Real AMQP 0-9-1 semantics, real Erlang/OTP behaviour, real version history (mirrored queues
  deprecated in 3.9 and removed in 4.0; quorum queues from 3.8; streams from 3.9; Khepri replacing Mnesia).

## Tone
Confident, precise, first-principles. Explain WHY at every step. Derive, don't assert. Flowing technical prose
in `<p>` paragraphs with occasional `ul.plain` lists — not bullet soup.
