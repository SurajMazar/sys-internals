# SYS/INTERNALS — structure & how to extend cheaply

Open `index.html` in a browser. Everything is static; no server needed.

## Deploying to Vercel

Pure static site, no build step, no framework. Two ways:

**CLI**

```bash
npm i -g vercel
cd <this folder>
vercel          # preview deploy
vercel --prod   # production
```

When asked for settings, accept the defaults — **framework: Other, build command: none,
output directory: `./`**. There is nothing to compile.

**Git**

Push this folder to a repo and import it at vercel.com. Same settings: framework "Other",
leave build and output empty. Every push then redeploys.

`vercel.json` sets cache headers (`assets/` 1 h, `data/` 5 min so content edits appear quickly)
and two safety headers. `.vercelignore` keeps the `_*.py` tooling and `_SPEC*.md` out of the deploy.

Notes:

- All paths are relative, so the site also works from a subpath or from `file://`.
- Filenames are all lowercase and links match exactly — Vercel's filesystem is case-sensitive
  where macOS is not, so keep new filenames lowercase.
- `.html` extensions are kept in links; do not enable `cleanUrls` unless you also rewrite them.

## Layout

```
index.html                 landing page (2 KB shell)
course-postgresql.html     course pages (2 KB shells)
course-kafka.html
course-whatsapp.html

data/site.js               ← SINGLE SOURCE OF TRUTH. Edit this to add content.
assets/site.css            all shared styling
assets/site.js             renderer for landing + course pages, search, progress

pg-01.html … pg-21.html    PostgreSQL chapters
kafka-01.html … kafka-15.html
wa-01.html … wa-12.html
pg-lab.html                PostgreSQL hands-on lab

_build_nav.py              regenerates inter-chapter navigation in every lesson
_refactor.py               regenerates the shells + shared assets from data/site.js
_SPEC.md / _SPEC_KAFKA.md / _SPEC_WA.md / _SPEC_LAB.md
                           authoring specs — hand these to an agent when writing new content
```

## To make a change without regenerating anything

| Change | Edit | Then |
| --- | --- | --- |
| Chapter title, description, tags, simulator blurb | `data/site.js` → `COURSES` | nothing — pages read it live |
| Mark a chapter as built / unbuilt | `data/site.js` → `BUILT` | nothing |
| Add or edit a lab card | `data/site.js` → `LABS` | nothing |
| Site-wide styling | `assets/site.css` | nothing |
| Landing / course page behaviour | `assets/site.js` | nothing |

Because all four top-level pages are 2 KB shells reading the same data file, **adding a
chapter or a lab is a few lines in one file** — no HTML regeneration, no duplicated CSS.

## To add a whole new course

1. Append an entry to `COURSES` in `data/site.js` (`key`, `name`, `hex`, `tagline`, `desc`, `chapters[]`).
2. Add `key: "course-<name>.html"` to `COURSE_PAGE`.
3. Run `python3 _refactor.py` — it emits the new shell and refreshes the others.
4. Add the course to the `COURSES` dict in `_build_nav.py` and run it, so its chapters get prev/next nav.

## To add chapters to an existing course

1. Write the lesson file (`<course>-NN.html`) following the relevant `_SPEC_*.md`.
2. Add its id to `BUILT` in `data/site.js`.
3. Add its title to the course's list in `_build_nav.py`, then run `python3 _build_nav.py`
   — this injects the bottom navigation bar (prev / chapter dropdown / next) into every chapter,
   and is idempotent, so it is safe to re-run.

## Navigation contract

Every chapter has a fixed bottom bar with previous chapter, a jump-to-chapter dropdown,
the course page link, and next chapter. Keyboard: `[` and `]` move between chapters,
`j`/`k` move between sections within a chapter, `g` returns to top, `/` or `⌘K` opens search.

## Progress

Stored in `localStorage` under `sysinternals-progress-v1` (chapter ids → true).
The lab keeps its experiment checklist separately under `sysinternals-lab-pg`.
