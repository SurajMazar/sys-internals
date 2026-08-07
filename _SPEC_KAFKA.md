# SPEC — Apache Kafka Internals interactive course (Course 02, chapters kafka-01 … kafka-15)

## Reference implementation
`pg-01.html` in this folder is the CANONICAL TEMPLATE. **Read it first, in full.** Your chapter must be
indistinguishable from it in structure, CSS quality, and depth. Copy its entire `<style>` block, then change
ONLY the accent: set `--pg:#f25c54;` and `--pg-dim:rgba(242,92,84,.12);` (Kafka red) and make the hero
gradient red→orange. Everything else stays identical so all courses feel like one product.

Copy verbatim: `#topbar`, `#toc`, `#readbar`, hero block, `.lesson-end`, and the JS helpers
`el()`, `stepper()`, `qaCards()`, the `QUIZ` array + renderer, the order-quiz, and the closing chrome block
(readbar, scrollspy, keyboard nav, mark-done).

Topbar crumb: `APACHE KAFKA INTERNALS · <b>CH 0N / 15</b> · <SHORT NAME>`

Other complete examples you may skim for conventions: `pg-09.html`, `pg-21.html` (capstone shape), `wa-05.html`.

## Audience
Senior → Staff/Principal engineers who already USE Kafka. Teach **internal implementation only**.
Never write "Kafka does X" — say which thread does it, which class/file implements it, which data structure holds
it, which lock or lock-free construct protects it, what the algorithm is, its complexity, and which alternatives
were rejected and why. Reference real Scala/Java classes (`KafkaApis`, `ReplicaManager`, `LogSegment`,
`RecordAccumulator`, `GroupCoordinator`, `TransactionCoordinator`, `SocketServer`, `Sender`, `LogCleaner`,
`KafkaRaftClient`) and real file paths under `core/src/main/scala/kafka/…` and `clients/src/main/java/org/apache/kafka/…`.
Cite real KIPs by number where they explain a design (KIP-98 EOS, KIP-101 leader epochs, KIP-227 fetch sessions,
KIP-392 follower fetching, KIP-429 cooperative rebalancing, KIP-500 KRaft, KIP-848 next-gen consumer rebalance).

## Mandatory structure — 16 `<section>` elements, ids `s1`..`s16`
1. `s1` THE PROBLEM
2. `s2` HISTORICAL CONTEXT — **interactive clickable timeline widget**
3. `s3` NAIVE SOLUTION — code block showing the strawman
4. `s4` WHY IT FAILS — quantified, with math
5. `s5` BETTER SOLUTION — candidates examined and eliminated; **stepper deck**
6. `s6` WHY THAT STILL FAILS / COSTS
7. `s7` FINAL ARCHITECTURE — **interactive explorer widget** (clickable components → detail pane)
8. `s8` INTERNAL IMPLEMENTATION — the core. Byte layouts, structs/classes, state machines, algorithms.
   At least one **stepper deck** and one **slider-driven widget**.
9. `s9` TRADEOFFS — `table.cmp` comparing against RabbitMQ, Pulsar, NATS/JetStream, SQS/Kinesis, ActiveMQ,
   Redpanda, and traditional brokers as relevant
10. `s10` PERFORMANCE CHARACTERISTICS — Big-O, page cache, disk access patterns, NIC/throughput math,
    GC behaviour, a **canvas chart widget**
11. `s11` REAL-WORLD PRODUCTION — named incidents, published numbers (LinkedIn/Uber/Netflix scale), postmortems
12. `s12` INTERVIEW QUESTIONS — 6-7 `qaCards()`, levels SENIOR/STAFF/PRINCIPAL
13. `s13` SOURCE CODE WALKTHROUGH — `.ftree` module tree + 2-4 annotated `.codeblock`s of simplified-but-faithful
    real Kafka Scala/Java, plus a "why the developers wrote it this way" callout
14. `s14` QUIZ — 6 multiple-choice (each wrong answer explained) + one sequencing/ordering challenge
15. `s15` SIMULATOR — the chapter's flagship interactive simulation, exposing live internal state with
    failure injection / parameter manipulation
16. `s16` KNOWLEDGE CHECK — 3 `qaCards()` "THINK" questions, no options, forward-referencing the next chapter

## Interactivity requirements
Per chapter minimum: 1 clickable timeline, 2+ stepper decks, 1 architecture explorer, 2+ slider-driven live
widgets, 1 canvas animation or chart, 1 quiz + order quiz, 1 substantial simulator. Prefer `<canvas>`/SVG for
anything that moves; requestAnimationFrame; smooth 60fps. Log/segment/partition/replication flow animations are
especially appropriate for this course.

## Hard rules
- **Single self-contained HTML file.** No frameworks, no CDN, no images, no localStorage except the progress key.
- Dark mode only.
- Topbar back-link `<a href="index.html">← Hub</a>`.
- `.lesson-end` `#mark-done` writes `p["<chapter-id>"] = true` into localStorage key `sysinternals-progress-v1`.
- "Next chapter" button links to the next file (e.g. `kafka-03.html`). For kafka-15, link back to `index.html`
  reading "← Course complete · Back to hub".
- **Verify before finishing**: extract the `<script>` block, run `node --check` via bash
  (folder maps to `/sessions/*/mnt/outputs`). Fix syntax errors. Confirm exactly 16 sections and >100 KB.
  Grep every `el("...")` against actual `id=` attributes — no missing DOM ids.
- Accuracy matters. Real config names (`linger.ms`, `batch.size`, `min.insync.replicas`, `acks`,
  `max.poll.interval.ms`, `log.cleaner.min.cleanable.ratio`, `replica.lag.time.max.ms`), real defaults,
  real version history. Describe mechanisms accurately rather than inventing identifiers.

## Tone
Confident, precise, first-principles. Explain WHY at every step. Derive, don't assert. Flowing technical prose
in `<p>` paragraphs with occasional `ul.plain` lists — not bullet soup.
