# SPEC — Kubernetes Internals (k8s-01…18), Beginner → Advanced

## Your chapter's brief lives in `data/site.js`
Find your chapter id in the `COURSES` array (key `"k8s"`). Its `title`, `desc`, `tags`, and `sim` fields
are the authoritative brief — `desc` lists the topics you must cover, `sim` describes the flagship
simulator. Expand that brief into a full chapter; do not narrow it.

## This course explicitly runs beginner → advanced
Chapters k8s-01 through k8s-05 are BEGINNER: assume the reader has used Docker but never touched
Kubernetes. Define every term the first time it's used (Pod, Service, Deployment) and don't assume
familiarity with `kubectl`. Chapters k8s-06 through k8s-12 are INTERMEDIATE: assume the beginner
chapters were read; go into control-plane and object-model internals. Chapters k8s-13 through k8s-17
are ADVANCED: security internals, multi-tenancy, observability internals, real production incidents,
and advanced scheduling/multi-cluster patterns — assume a working operator's fluency. k8s-18 is the
CAPSTONE. Put a small tier badge in the hero (BEGINNER / INTERMEDIATE / ADVANCED / CAPSTONE) so the
reader always knows where they are in the arc.

## Reference implementation
`pg-01.html` is the CANONICAL TEMPLATE — read it in full. Copy its entire `<style>` block, its `<head>`
favicon/theme-color links, `#topbar`, `#toc`, `#readbar`, hero block, `.lesson-end`, and its JS helpers
(`el`, `stepper`, `qaCards`, the `QUIZ` array + renderer, the order-quiz, and the closing chrome block).

Accent — change ONLY these two CSS variables:
- `--pg:#326ce5;` and `--pg-dim:rgba(50,108,229,.12);` — Kubernetes blue (the project's real brand blue),
  hero gradient blue→cyan.

Topbar crumb: `KUBERNETES INTERNALS · <b>CH 0N / 18</b> · <SHORT NAME>`
Topbar back link: `course-kubernetes.html` with course name "Kubernetes Internals".

⚠ **Write all prose and all simulator JS fresh.** Sibling chapters have failed review for leaving another
course's content or JS behind. Every `el("...")` in your file must match a real `id=` in that same file, and
the file must contain zero PostgreSQL/Kafka/RabbitMQ/blockchain/Bitcoin/generic-container/cryptography
terms except in a deliberate, brief comparison sentence.

## Relationship to the Container Internals course already on this site
That course already covers namespaces, cgroups v2, OverlayFS, capabilities, seccomp, the OCI runtime spec,
and Docker-vs-Podman in deep kernel-level detail. This course does NOT re-teach those — Kubernetes runs
containers, it doesn't reinvent container isolation. Where a Kubernetes concept sits directly on top of a
container-internals primitive (e.g. a Pod's shared network namespace, or how the kubelet talks to a CRI
runtime which in turn calls an OCI-compliant low-level runtime), a single cross-reference sentence to the
Container Internals course is appropriate; do not re-derive namespace/cgroup mechanics from scratch.

## Audience
Senior → Staff/Principal engineers, but written for a genuine beginner in chapters 1-5 as stated above.
Teach **mechanism**, not "Kubernetes is a container orchestrator" hand-waving — say precisely what problem
each component solves and how. Never say "Kubernetes is self-healing" without explaining the exact
reconciliation-loop mechanism that makes it true. No vendor boosterism for any specific cloud provider's
managed Kubernetes offering; where EKS/GKE/AKS genuinely differ in a way worth knowing (e.g. control-plane
visibility, upgrade cadence), say so neutrally.

Be precise with numbers and cite real artifacts: real API object fields and `apiVersion` strings, real
`kubectl` command syntax, real component names and default ports (API server 6443, etcd 2379/2380, kubelet
10250), real CVE ids (CVE-2018-1002105 API server proxy request-smuggling privilege escalation, CVE-2019-11253
Billion Laughs YAML DoS, CVE-2020-8558 node-local traffic redirection), real KEP (Kubernetes Enhancement
Proposal) numbers where relevant, and real scaling limits/thresholds (etcd's recommended <8KB per value and
practical multi-GB total size ceiling, the default 110 pods/node, the 5000-node/150000-pod SLO envelope).

## Mandatory structure — 16 `<section>` elements, ids `s1`..`s16`
1. `s1` THE PROBLEM  2. `s2` HISTORICAL CONTEXT (**interactive timeline widget** — Borg/Omega lineage,
   Kubernetes' 2014 announcement, CNCF donation, major version milestones)
3. `s3` NAIVE SOLUTION (code block strawman — e.g. a hand-rolled bash script doing what the chapter's
   component does, to motivate why it exists)  4. `s4` WHY IT FAILS (quantified, with math)
5. `s5` BETTER SOLUTION (**stepper deck**)  6. `s6` WHY THAT STILL FAILS / COSTS
7. `s7` FINAL ARCHITECTURE (**interactive explorer widget**)
8. `s8` INTERNAL IMPLEMENTATION — the core: real API object YAML/JSON shapes, real control-loop
   pseudocode, real byte/wire formats where relevant. At least one **stepper deck** and one
   **slider-driven widget**.
9. `s9` TRADEOFFS — `table.cmp` comparing alternatives honestly
10. `s10` PERFORMANCE / SECURITY CHARACTERISTICS — complexity, real scaling limits, a **canvas chart**
11. `s11` REAL-WORLD INCIDENTS — named CVEs/outages with root-cause analysis
12. `s12` INTERVIEW QUESTIONS — 6-7 `qaCards()`, SENIOR/STAFF/PRINCIPAL
13. `s13` CODE WALKTHROUGH — `.ftree` module tree + 2-4 annotated `.codeblock`s (real Kubernetes Go
    source shape — e.g. `pkg/scheduler`, `pkg/controller`, `staging/src/k8s.io/client-go/tools/cache` —
    or precise reference pseudocode), plus a "why it was built this way" callout
14. `s14` QUIZ — 6 multiple-choice (each wrong answer explained) + one ordering challenge
15. `s15` SIMULATOR — the flagship interactive simulation from your `sim` field
16. `s16` KNOWLEDGE CHECK — 3 `qaCards()` "THINK" questions forward-referencing the next chapter (the
    final chapter, k8s-18, should instead ask reflective/synthesis questions about the whole course)

## Interactivity
Minimum: 1 clickable timeline, 2+ stepper decks, 1 explorer, 2+ slider widgets, 1 canvas animation/chart,
quiz + order quiz, 1 substantial simulator. Prefer `<canvas>`/SVG for anything that moves;
requestAnimationFrame; 60fps. Reconciliation loops, scheduler filter/score passes, watch-event streams,
rolling updates, and the control-plane request pipeline are all excellent candidates for animation.

**Where you simulate control-plane behavior, make the state machine genuinely consistent.** If you show a
Deployment rolling update, the replica counts at each step must actually add up (maxSurge/maxUnavailable
math must be real); if you show a scheduler scoring pass, the scores must be computed from the stated
inputs, not decorative.

## Hard rules
- Single self-contained HTML file. No frameworks, no CDN, no images, no localStorage except the progress key.
- Dark mode only. `.lesson-end` `#mark-done` writes `p["<chapter-id>"] = true` into `sysinternals-progress-v1`.
- Next-chapter button links to the next file. Final chapter (k8s-18) links back to `index.html`
  reading "← Course complete · Back to hub".
- **Verify before finishing**: extract the `<script>`, run `node --check` via bash; confirm exactly 16
  sections, >100 KB, file ends with `</html>`, every `el("...")` resolves, zero cross-course contamination.

## Tone
Confident, precise, first-principles. Derive, don't assert. Flowing prose in `<p>` paragraphs with
occasional `ul.plain` lists — not bullet soup. Beginner chapters (1-5) should still be precise and never
condescending — clarity is not the same as simplification.
