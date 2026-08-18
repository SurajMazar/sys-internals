# SPEC — AWS Certified Solutions Architect: Associate + Professional Exam Prep (aws-01…24 + aws-lab)

## What this course actually is — read this before anything else
Every other course on this site teaches deep systems internals via a fixed derivation arc (problem →
naive solution → why it fails → better solution → final architecture). **This course is different, by
explicit user request: it is PURE EXAM PREP**, not an internals deep-dive. The reader's goal is to pass two
real AWS certification exams — AWS Certified Solutions Architect Associate (**SAA-C03**) and AWS Certified
Solutions Architect Professional (**SAP-C02**) — not to learn how S3 is implemented internally. Prioritize
breadth, exam-pattern recognition, decision frameworks ("when do I pick X vs Y"), common exam traps, and
realistic scenario-based practice questions over source-level mechanism. It's fine — good, even — to
explain *why* a service behaves a certain way in a sentence or two, but do not turn a chapter into a deep
architectural derivation the way the PostgreSQL/Kafka/Kubernetes courses on this site do. If you find
yourself writing more than a short paragraph of "how it works internally," stop and redirect that space to
another exam-relevant angle (a trap, a decision rule, a limit, a scenario) instead.

## Your chapter's brief lives in `data/site.js`
Find your chapter id in the `COURSES` array (key `"aws"`). Its `title`, `desc`, `tags`, and `sim` fields are
the authoritative brief — `desc` lists the topics you must cover, `sim` describes the flagship simulator.
Expand that brief into a full chapter; do not narrow it.

## The two real exams this course targets — verified facts, use exactly these
**AWS Certified Solutions Architect – Associate (SAA-C03)**: 65 questions (50 scored + 15 unscored), 130
minutes, multiple-choice + multiple-response, pass score 720/1000, exam fee $150 (state pricing as "at the
time of writing" — it can change). Domains and their real weights: **Design Secure Architectures (30%)**,
**Design Resilient Architectures (26%)**, **Design High-Performing Architectures (24%)**, **Design
Cost-Optimized Architectures (20%)**. Recommended experience: 1+ year hands-on designing AWS solutions; no
prerequisite certification required.

**AWS Certified Solutions Architect – Professional (SAP-C02)**: 75 questions (65 scored + 10 unscored), 180
minutes, multiple-choice + multiple-response, pass score 750/1000, exam fee $300 (same pricing caveat).
Domains and their real weights: **Design Solutions for Organizational Complexity (26%)**, **Design for New
Solutions (29%)**, **Continuous Improvement for Existing Solutions (25%)**, **Accelerate Workload Migration
and Modernization (20%)**. Recommended experience: 2+ years designing/implementing AWS solutions.

Every chapter's `s1` section must state which exam(s) and which specific domain(s) it maps to, using these
real domain names and weights — this is the organizing spine of the whole course.

## Accuracy rules — this is the load-bearing rule for this course
- **Stable technical facts** (safe to state as fact, verified current): S3 durability is designed for
  99.999999999% ("11 nines"); Lambda's maximum function timeout is 900 seconds (15 minutes); DynamoDB's
  maximum item size is 400 KB; EBS gp3 volumes have a baseline of 3,000 IOPS and 125 MiB/s throughput before
  you pay to provision more; the default S3 bucket quota per account is 10,000 (raised from the old default
  of 100 in November 2024 — mention the old number only if directly relevant as a "the exam may still
  reference the old limit" caveat, otherwise just state the current one); newer EC2 instance types launched
  since mid-2024 support IMDSv2 only, but don't claim IMDSv2 is universally the only option on every running
  instance — say precisely that it's the direction AWS has moved and why (SSRF-class attacks IMDSv1 was
  vulnerable to).
- **Perishable facts** (dollar pricing beyond the exam fees above, specific current discount percentages):
  state real orders-of-magnitude and relative comparisons (Spot is typically dramatically cheaper than
  On-Demand; Savings Plans trade commitment for a discount that's typically deeper than Reserved Instances'
  in exchange for more flexibility) rather than a specific number that will go stale, and say so.
- **Never invent a specific exam question that claims to be a real leaked question.** Practice questions you
  write must be original, clearly your own scenario-style constructions modeled on the real domain weights
  and real service behavior — do not claim or imply they come from an actual exam.
- Where you're genuinely unsure of a specific current detail, say so plainly and give the reader the
  general decision framework instead of a fabricated specific number.

## Reference implementation
`pg-01.html` is the CANONICAL TEMPLATE for the file's chrome/mechanics — read it in full for structure, but
**this course repurposes its 16-section skeleton for exam content** (see the Mandatory Structure section
below — the section *topics* are different from the internals courses even though the ids/count are the
same). Copy the base dark `:root` block (then change only the two accent variables below), `#topbar`/
`#toc`/`#readbar`, hero block, `.lesson-end`, and the JS helpers (`el`, `stepper`, `qaCards`, the `QUIZ`
array + renderer, the order-quiz, and the rest of the closing chrome).

**Do NOT copy the injected theme-machinery pieces** — they're added automatically afterward by
`_build_theme.py` / `_build_theme_fix2.py`. Omit:
- The `<!-- THEME-EARLY -->` inline `<script>` right after `<head>`.
- The `/* THEME-LIGHT-OVERRIDE */` block (`html[data-theme="light"] { ... }`) and its `#theme-toggle` CSS.
- The `/* THEME-TEXT-FIX-V2 */` marker and its `canvas{background:...!important}` rule.
- The `<!-- THEME-BTN -->` button + its click-handler `<script>` inside `#topbar`.

It's fine — expected — to also look at an already-built sibling chapter in this course once one exists, to
match the established in-course pattern exactly.

⚠ **Do not reintroduce the light-mode text bug this site already fixed once.** The template's prose/body
text already reads `color:var(--body)` (never a hardcoded hex like `#c6cddb`), with `--body:#c6cddb;`
declared in `:root` as its dark-mode value. Keep that pattern everywhere — `<p>`, list items, callouts,
table cells, quiz options, decision-framework tables, QA answers, file trees, etc. must read
`var(--body)`/`var(--text)`/`var(--muted)` — never a literal hex on a `var(--panel)`/`var(--bg)`/
`var(--bg-2)` background. Code blocks, the log console, and `<canvas>` may keep a fixed dark background
(established pattern for JS-drawn/syntax-highlighted content) — nothing else.

Accent — change ONLY these two CSS variables:
- `--pg:#ff9900;` and `--pg-dim:rgba(255,153,0,.12);` — AWS's real "Smile" brand orange.

Topbar crumb: `AWS SOLUTIONS ARCHITECT PREP · <b>CH 0N / 24</b> · <SHORT NAME>`
Topbar back link: `course-aws.html` with course name "AWS Certification Prep".

⚠ **Write all prose and all simulator JS fresh.** The file must contain zero PostgreSQL/Kafka/RabbitMQ/
blockchain/Bitcoin/container/cryptography/Kubernetes/Rust/Uber/Netflix terms except in a deliberate, brief
comparison sentence if genuinely useful (e.g. "if you've used Kafka, EventBridge's fan-out model will feel
familiar" is fine as one sentence; do not re-derive another course's internals here).

## Mandatory structure — 16 `<section>` elements, ids `s1`..`s16` (exam-prep semantics)
1. `s1` EXAM CONTEXT — which exam(s) and domain(s) this maps to (real names + weights from above), and why
   this topic matters on test day (**small interactive timeline widget** is fine here if there's a genuine
   real dated fact to show — e.g. a service's real GA year — but keep it brief; this is not the chapter's
   focus)
2. `s2` THE COMMON WRONG INSTINCT — the plausible-sounding but incorrect first answer many candidates pick
3. `s3` WHY IT'S WRONG — the specific mechanism/limit/cost reason the wrong instinct fails, quantified where
   a real stable number applies
4. `s4` THE CORRECT APPROACH (**stepper deck** walking through the real feature/decision logic)
5. `s5` FEATURE MATRIX / SERVICE OPTIONS (**interactive explorer widget** — e.g. click a service to see its
   real feature set)
6. `s6` LIMITS, QUOTAS & EDGE CASES the correct approach still has to respect
7. `s7` REFERENCE ARCHITECTURE (a concrete, realistic architecture diagram/explorer using this chapter's
   services correctly)
8. `s8` CONFIGURATION / CLI WALKTHROUGH — at least one **stepper deck** and one **slider-driven widget**
   over realistic (illustrative, clearly labeled as example syntax) CLI/config
9. `s9` DECISION FRAMEWORK — `table.cmp` comparing the realistic options honestly ("use X when / use Y
   when"), the single most exam-relevant artifact in the chapter
10. `s10` LIMITS & SCALING NUMBERS — a **canvas chart** of a real, stable quota/throughput/scaling curve
11. `s11` REAL-WORLD SCENARIO CASE STUDIES — 2-3 realistic, clearly-original scenario vignettes (not claimed
    as real leaked exam content) showing this topic being tested the way the real exam actually phrases
    scenario questions (a company profile + constraints + "which approach should they choose")
12. `s12` SAMPLE EXAM QUESTIONS — 6-7 `qaCards()`, explicitly labeled by which exam/domain they'd appear in
    (ASSOCIATE / PROFESSIONAL), written as original scenario-style questions
13. `s13` CLI / CODE REFERENCE — `.ftree` + 2-4 annotated `.codeblock`s of realistic CLI/IaC syntax, clearly
    illustrative, plus a "why the exam cares about this" callout
14. `s14` QUIZ — 6 multiple-choice (each wrong answer explained — this is where exam traps get taught
    explicitly) + one ordering challenge (e.g. order the steps of a real process/workflow)
15. `s15` SCENARIO SIMULATOR — the flagship interactive simulation from your `sim` field; for this course,
    prefer "design/configure it yourself and see if it satisfies the stated constraints" simulators over
    passive animations, since that's the actual exam skill being trained
16. `s16` EXAM-DAY TAKEAWAYS — a tight bulleted-in-prose recap of the 3-5 things most likely to be tested
    from this chapter, plus `qaCards()` "THINK" questions forward-referencing the next chapter (the final
    chapter, aws-24, should instead ask reflective/synthesis questions about the whole course)

## Interactivity
Minimum: 1 stepper deck (ideally 2+), 1 explorer, 2+ slider/config widgets, 1 canvas chart, quiz + order
quiz, 1 substantial "configure it yourself" simulator. Make simulated math genuinely computed — if a
simulator claims a design meets a stated RTO/RPO or cost target, actually compute that from the reader's
choices, don't decorate a fixed outcome.

## The lab: aws-lab.html
Unlike the chapters, the lab is REAL hands-on work in the reader's own actual AWS account, free-tier
eligible wherever possible — not a simulator. Structure it like this site's other labs (see `k8s-lab.html`
or `ctr-lab.html` for the established lab-file pattern: numbered real exercises, a progress-tracking
checklist persisted the same way via `sysinternals-lab-aws` in localStorage, a config/CLI cheat-sheet, and a
couple of small build projects). Cover real, genuine free-tier-safe exercises across both exam levels: IAM
policy simulator exercises, launching and connecting to a t2/t3.micro EC2 instance, an S3 bucket with
versioning/lifecycle rules, a VPC with public/private subnets and a NAT gateway (flag the NAT gateway's
hourly cost honestly — it is NOT free-tier — and suggest a NAT instance or skipping that specific step as a
free alternative), a DynamoDB table on-demand mode, a Lambda function invoked via the CLI, a CloudWatch
billing alarm, and an AWS Budgets cost alert (importantly, get the reader to set this up EARLY, before the
other exercises, so they have a safety net). Every command must be real, correct AWS CLI v2 syntax. Include
a prominent, explicit "how to tear every resource in this lab back down to zero, in order" section near the
top or in a persistent sidebar — cost safety is the single most important thing to get right in a real-money
hands-on lab.

## Hard rules
- Single self-contained HTML file per chapter/lab. No frameworks, no CDN, no images, no localStorage except
  the progress/lab-checklist keys.
- Both dark and light mode must work (copy the template's already-fixed theme system verbatim — see the
  CRITICAL note above about `var(--body)`).
- `.lesson-end` `#mark-done` writes `p["<chapter-id>"] = true` into `sysinternals-progress-v1`.
- Next-chapter button links to the next file. Final chapter (aws-24) links back to `index.html` reading
  "← Course complete · Back to hub".
- **Verify before finishing**: extract the `<script>`, run `node --check` via bash; confirm exactly 16
  sections (chapters only — the lab has its own reasonable structure, not this 16-section arc), >100 KB,
  file ends with `</html>`, every `el("...")` resolves, zero cross-course contamination, zero hardcoded hex
  colors used as `color:` on prose/list/table/quiz text.

## Tone
Confident, practical, exam-focused. Prefer clear decision rules and "here's the trap" callouts over abstract
theory. Flowing prose in `<p>` paragraphs with occasional `ul.plain` lists — not bullet soup.
