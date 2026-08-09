# SPEC — Container Internals (ctr-01…16): Docker vs Podman

## Your chapter's brief lives in `data/site.js`
Find your chapter id in the `COURSES` array (key `"ctr"`). Its `title`, `desc`, `tags`, and `sim` fields
are the authoritative brief — `desc` lists the topics you must cover, `sim` describes the flagship
simulator. Expand that brief into a full chapter; do not narrow it.

## Reference implementation
`pg-01.html` is the CANONICAL TEMPLATE — read it in full. Copy its entire `<style>` block, its `<head>`
favicon/theme-color links, `#topbar`, `#toc`, `#readbar`, hero block, `.lesson-end`, and its JS helpers
(`el`, `stepper`, `qaCards`, the `QUIZ` array + renderer, the order-quiz, and the closing chrome block).

Accent — change ONLY these two CSS variables:
- `--pg:#2dd4bf;` and `--pg-dim:rgba(45,212,191,.12);` — teal/cyan, gradient teal→blue in the hero
  (this course compares two engines, so the hero gradient should read as neither brand's own color —
  Docker blue `#2496ed` and Podman purple `#892ca0` should only appear as small inline accent chips when
  a specific engine's behavior is being called out, never as the page's primary accent).

Topbar crumb: `CONTAINER INTERNALS · <b>CH 0N / 16</b> · <SHORT NAME>`
Topbar back link: `course-containers.html` with course name "Container Internals".

⚠ **Write all prose and all simulator JS fresh.** Sibling chapters have failed review for leaving another
course's content or JS behind. Every `el("...")` in your file must match a real `id=` in that same file, and
the file must contain zero PostgreSQL/Kafka/RabbitMQ/blockchain/Bitcoin terms except in a deliberate
comparison sentence.

## Audience
Senior → Staff/Principal engineers. Assume strong Linux/systems background, no prior container-internals
knowledge. Teach **mechanism**, not marketing. Never say "containers are lightweight VMs" — say precisely
what they share with the host (kernel) and what isolates them (namespaces, cgroups, capabilities, LSMs).
No vendor boosterism for either Docker or Podman — where one is genuinely better for a use case, say so
and say why; where they are equivalent, say that too.

**Docker vs Podman must be compared at every layer where they meaningfully differ**, not bolted on as an
afterthought: daemon vs fork-exec architecture, rootful-by-default vs rootless-by-default, CNM/libnetwork
vs netavark, no pod concept vs native pods, `docker generate` (n/a) vs `podman generate systemd`/Quadlets,
runc vs crun as default low-level runtime, AppArmor-first vs SELinux-first defaults. Where they are
identical (both consume the same OCI Runtime Spec, both use overlayfs, both enforce the same seccomp
default profile shape), say that plainly instead of manufacturing a difference.

Be precise with numbers and cite real artifacts: CVE ids, real syscall names and flags, real cgroup
interface filenames, real default capability/seccomp lists, real kernel version numbers where a feature
landed (e.g. cgroup v2 unified hierarchy, user namespaces in 3.8, rootless overlayfs in 5.11+).

## Mandatory structure — 16 `<section>` elements, ids `s1`..`s16`
1. `s1` THE PROBLEM  2. `s2` HISTORICAL CONTEXT (**interactive timeline widget**)
3. `s3` NAIVE SOLUTION (code block strawman)  4. `s4` WHY IT FAILS (quantified, with math)
5. `s5` BETTER SOLUTION (**stepper deck**)  6. `s6` WHY THAT STILL FAILS / COSTS
7. `s7` FINAL ARCHITECTURE (**interactive explorer widget**)
8. `s8` INTERNAL IMPLEMENTATION — the core: real syscalls, real file paths (`/proc/pid/uid_map`,
   `/sys/fs/cgroup/.../memory.max`, `/proc/pid/ns/*`), byte layouts, state machines. At least one
   **stepper deck** and one **slider-driven widget**.
9. `s9` TRADEOFFS — `table.cmp` comparing alternatives honestly (this is usually where Docker vs Podman
   gets its most detailed side-by-side treatment for the chapter's specific layer)
10. `s10` PERFORMANCE / SECURITY CHARACTERISTICS — complexity, attack surface, startup latency, a
    **canvas chart**
11. `s11` REAL-WORLD INCIDENTS — named CVEs/events with root-cause analysis
12. `s12` INTERVIEW QUESTIONS — 6-7 `qaCards()`, SENIOR/STAFF/PRINCIPAL
13. `s13` CODE WALKTHROUGH — `.ftree` module tree + 2-4 annotated `.codeblock`s (real runc/crun/Linux
    kernel source shape, or real syscall sequences in C), plus a "why it was built this way" callout
14. `s14` QUIZ — 6 multiple-choice (each wrong answer explained) + one ordering challenge
15. `s15` SIMULATOR — the flagship interactive simulation from your `sim` field
16. `s16` KNOWLEDGE CHECK — 3 `qaCards()` "THINK" questions forward-referencing the next chapter (the
    final chapter, ctr-16, should instead ask reflective/synthesis questions about the whole course)

## Interactivity
Minimum: 1 clickable timeline, 2+ stepper decks, 1 explorer, 2+ slider widgets, 1 canvas animation/chart,
quiz + order quiz, 1 substantial simulator. Prefer `<canvas>`/SVG for anything that moves;
requestAnimationFrame; 60fps. Namespace creation, cgroup limit enforcement, overlayfs layer stacking,
capability dropping, seccomp syscall filtering, and process-tree diffs between Docker/Podman are all
excellent candidates for animation.

**Where you show low-level mechanics, make them real or at least realistic and internally consistent.**
If you simulate `/proc/<pid>/uid_map` contents, cgroup interface file reads/writes, or syscall return
values, use real formats and real error codes (EPERM, EACCES, ENOSYS) rather than placeholder text.

## Hard rules
- Single self-contained HTML file. No frameworks, no CDN, no images, no localStorage except the progress key.
- Dark mode only. `.lesson-end` `#mark-done` writes `p["<chapter-id>"] = true` into `sysinternals-progress-v1`.
- Next-chapter button links to the next file. Final chapter (ctr-16) links back to `index.html`
  reading "← Course complete · Back to hub".
- **Verify before finishing**: extract the `<script>`, run `node --check` via bash; confirm exactly 16
  sections, >100 KB, file ends with `</html>`; every `el("...")` resolves; zero cross-course contamination.

## Tone
Confident, precise, first-principles. Derive, don't assert. Flowing prose in `<p>` paragraphs with
occasional `ul.plain` lists — not bullet soup.
