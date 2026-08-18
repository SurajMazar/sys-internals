# SYS/INTERNALS

A static site of deep-dive interactive courses on how real systems are built internally — animated
simulators, source-code walkthroughs, byte-level layouts, failure injection. **13 courses, 222
chapters, 10 hands-on labs.** No framework, no build step, no server: open `index.html` in a browser.

## Courses

| Key | Course | Chapters | Lab | Page | Authoring spec |
| --- | --- | --- | --- | --- | --- |
| `aws` | AWS Certification Prep | 24 | ✅ | `course-aws.html` | `_SPEC_AWS.md` |
| `btc` | Bitcoin Internals | 16 | ✅ | `course-bitcoin.html` | `_SPEC_CHAIN.md` |
| `bc` | Blockchain Fundamentals | 14 | ✅ | `course-blockchain.html` | `_SPEC_CHAIN.md` |
| `ctr` | Container Internals (Docker vs Podman) | 16 | ✅ | `course-containers.html` | `_SPEC_CONTAINERS.md` |
| `crypto` | Applied Cryptography Internals | 16 | ✅ | `course-crypto.html` | `_SPEC_CRYPTO.md` |
| `kafka` | Apache Kafka Internals | 15 | ✅ | `course-kafka.html` | `_SPEC_KAFKA.md` |
| `k8s` | Kubernetes Internals | 18 | ✅ | `course-kubernetes.html` | `_SPEC_K8S.md` |
| `nflx` | Netflix Streaming Internals | 18 | — | `course-netflix.html` | `_SPEC_NETFLIX.md` |
| `pg` | PostgreSQL Internals | 21 | ✅ | `course-postgresql.html` | `_SPEC.md` |
| `rmq` | RabbitMQ Internals | 12 | ✅ | `course-rabbitmq.html` | `_SPEC_RMQ.md` |
| `rust` | Rust: Beginner to Advanced | 22 | ✅ | `course-rust.html` | `_SPEC_RUST.md` |
| `uber` | Uber Engineering Internals | 18 | — | `course-uber.html` | `_SPEC_UBER.md` |
| `wa` | WhatsApp Architecture | 12 | — | `course-whatsapp.html` | `_SPEC_WA.md` |

Chapter files are `<key>-NN.html`; labs are `<key>-lab.html`. Course display order on the site is
alphabetical by short name and is decided in one place — `ORDERED` in `assets/site.js`.

## Architecture

Two kinds of page, with deliberately different tradeoffs:

**Hub pages are thin and data-driven.** `index.html` and every `course-*.html` is a ~1.5 KB shell that
loads `data/site.js` (content) + `assets/site.css` (styling) + `assets/site.js` (renderer), then calls
`renderLanding()` or `renderCourse("<key>")`. Adding a chapter card, a lab, or a whole course is an
edit to one data file — no HTML regeneration, no duplicated CSS.

**Chapter and lab pages are fully self-contained.** Each `<key>-NN.html` is 100–270 KB with its own
embedded `<style>` and `<script>` — no reference to `assets/`. That is why they hold hand-built canvas
simulators, and also why site-wide changes to them require a Python sweep rather than a CSS edit.

```
index.html                  landing shell
course-*.html               13 course shells

data/site.js                ← SINGLE SOURCE OF TRUTH: COURSES, BUILT, LABS, COURSE_PAGE, FLOW_STEPS
assets/site.css             all shared hub/course styling
assets/site.js              renderer for landing + course pages, top nav, search, theme, progress

pg-01.html … aws-24.html    222 self-contained chapters
pg-lab.html … aws-lab.html  10 self-contained labs

_refactor.py                regenerates the shells + shared assets from data/site.js
_build_nav.py               injects the bottom prev/next/dropdown nav bar into every chapter
_build_theme.py             injects the light/dark toggle + light overrides into every chapter
_build_theme_fix2.py        light-mode readability pass (run after _build_theme.py)
_add_courses.py             one-off: appended the bc + btc courses to data/site.js
_SPEC*.md                   authoring specs — hand these to an agent when writing new content
```

`data/site.js` exports four things that matter:

- `COURSES` — course metadata (`key`, `name`, `short`, `hex`, `tagline`, `desc`) and every chapter's
  `id`, `title`, `desc`, `tags[]`, `sim` blurb. This is what the cards and search index read.
- `BUILT` — the set of chapter ids whose lesson file actually exists. Anything absent renders as
  "not yet built", so a chapter can be described before it is written.
- `LABS` — lab card per course key (`file`, `title`, `desc`).
- `COURSE_PAGE` — course key → its shell filename. Must stay in sync with `COURSES`.

## Making a change

| Change | Edit | Then |
| --- | --- | --- |
| Chapter title, description, tags, simulator blurb | `data/site.js` → `COURSES` | nothing — pages read it live |
| Mark a chapter as built / unbuilt | `data/site.js` → `BUILT` | nothing |
| Add or edit a lab card | `data/site.js` → `LABS` | nothing |
| Hub/course styling | `assets/site.css` | nothing |
| Landing / course page behaviour, search, top nav | `assets/site.js` | nothing |
| Anything inside a chapter page | that chapter's HTML | nothing |
| Site-wide chapter-page change (theme, nav) | the relevant `_build_*.py` | re-run it over all files |

### Add chapters to an existing course

1. Write `<key>-NN.html` following that course's `_SPEC_*.md`.
2. Add its id to `BUILT` in `data/site.js`.
3. Add its title to the course's list in `_build_nav.py`, then:

```bash
python3 _build_nav.py
```

4. Give the new file the theme toggle:

```bash
python3 _build_theme.py && python3 _build_theme_fix2.py
```

### Add a whole new course

1. Append an entry to `COURSES` in `data/site.js` (`key`, `name`, `short`, `hex`, `tagline`, `desc`,
   `chapters[]`).
2. Add `<key>: "course-<name>.html"` to `COURSE_PAGE`.
3. Add the course to the `COURSES` dict in `_build_nav.py`.
4. Write a `_SPEC_<NAME>.md` for whoever (or whatever) authors the chapters.
5. Create the course shell — copy an existing `course-*.html`, change the `<title>`, the Method blurb,
   and the `renderCourse("<key>")` argument. (`_refactor.py` regenerates shells from the original
   `index.html` and is effectively a one-time historical tool; copying a shell is the current path.)

All three `_build_*.py` scripts are **idempotent** — each injected piece is guarded by a marker
comment (`<!-- THEME-EARLY -->`, `<!-- THEME-BTN -->`, `id="chapnav"`), so re-running only touches
files missing that piece. Safe to run after every batch of new chapters.

## Chapter page contract

Every chapter follows the same shape, which the specs enforce and the build scripts assume:

- **Sections** `id="s1"`…`id="sN"`, tracking the 15 `FLOW_STEPS` in `data/site.js`: Problem → History
  → Naive solution → Why it fails → Better solution → Why it still fails → Final architecture →
  Implementation → Tradeoffs → Performance → Production examples → Interview questions → Source
  walkthrough → Quiz → Simulator.
- **Bottom nav bar** `id="chapnav"` — previous chapter, jump-to-chapter dropdown, course page link,
  next chapter. Injected by `_build_nav.py`; do not hand-edit.
- **Theme toggle** injected by `_build_theme.py`, with an early inline script in `<head>` that applies
  the stored theme before first paint to avoid a flash.
- **Keyboard**: `[` / `]` move between chapters, `j` / `k` between sections, `g` returns to top,
  `/` or `⌘K` opens search on hub pages.

### Theming caveat

Chapters were each authored on the same dark template, which hardcoded the body-text colour as the
literal `#c6cddb`. `_build_theme_fix2.py` rewrote those literals to `var(--body)` **inside `<style>`
blocks only** — occurrences inside `<script>` are canvas `fillStyle` calls, where `var()` is not a
valid colour. It also pins every `<canvas>` to a dark background in light mode, because canvas pixels
are drawn by JS with hardcoded light-on-dark colours and cannot be retro-themed by CSS. Keep both
rules in mind when touching colours in a chapter file.

## Chapter videos (AWS course, in progress)

Some AWS chapters ship a narrated, animated video (`assets/video/<chapter>.mp4`) embedded near the
top of the page, built by a separate Remotion + Kokoro TTS pipeline in `video/` — a real Node/Python
project, not part of the static site's own zero-build model, and excluded from the Vercel deploy via
`.vercelignore` (only the rendered `.mp4` ships). See [`video/README.md`](video/README.md) for the
component library, the storyboard format, and how to produce the next chapter's video.

## State

Stored in `localStorage`:

| Key | Holds |
| --- | --- |
| `sysinternals-progress-v1` | chapter ids → `true` (progress checkmarks) |
| `sysinternals-theme` | `"light"` / `"dark"` |
| `sysinternals-lab-<key>` | per-lab experiment checklist |

## Deploying to Vercel

Pure static site, no build step, no framework.

**CLI**

```bash
vercel --prod
```

Accept the defaults when asked — **framework: Other, build command: none, output directory: `./`**.
There is nothing to compile.

**Git** — push to a repo and import it at vercel.com with the same settings; every push redeploys.

`vercel.json` sets cache headers (`assets/` 1 h, `data/` 5 min so content edits appear quickly) plus
`X-Content-Type-Options` and `Referrer-Policy`. `.vercelignore` keeps the `_*.py` tooling and
`_SPEC*.md` out of the deploy.

Conventions that matter:

- All paths are relative, so the site also works from a subpath or from `file://`.
- Filenames are all lowercase and links match exactly — Vercel's filesystem is case-sensitive where
  macOS is not, so keep new filenames lowercase.
- `.html` extensions are kept in links; do not enable `cleanUrls` unless you also rewrite them.

## Repo hygiene

`_tmp_*.html`, `_tmp_*.js`, and `_crypto_core_test.mjs` are scratch artifacts from past authoring
sessions, not part of the site. The `.git-old-*/` and `.git-stale/` directories are orphaned git dirs
left by the sandbox's mount permissions; they are gitignored and safe to delete:

```bash
rm -rf .git-old-* .git-stale
```
