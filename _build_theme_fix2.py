#!/usr/bin/env python3
"""
Fix #2 for the light-mode theme: every chapter/lab file was independently
authored on top of the same template, which hardcodes the primary body-text
colour as the literal `#c6cddb` (used directly in the CSS of <p>, list items,
callouts, tables, quiz options, timeline/arch detail panels, QA answers, file
trees, etc. -- 13 to 18 occurrences per file, 2243 total) instead of a CSS
custom property. _build_theme.py only overrides declared --vars, so it never
touched this literal, leaving near-white light-mode backgrounds paired with
pale gray-blue text -- unreadable.

This script, run after _build_theme.py:
  1. Declares a new `--body` var in each file's dark :root (value: #c6cddb,
     pixel-identical to today) and in its light override block (value: a
     WCAG-darkened equivalent, contrast >=4.5:1 against white).
  2. Rewrites every `#c6cddb` literal *inside <style> blocks only* to
     `var(--body)` (occurrences inside <script> are canvas fillStyle calls
     and must never be touched -- var() is not a valid canvas colour).
  3. Forces every <canvas> element to keep a fixed dark background in light
     mode (!important, beats both var(--bg-2)-driven CSS and inline
     style="background:var(--bg-2)" attributes), because canvas pixels are
     drawn by JS with hardcoded light-on-dark colours and can't be
     retro-themed by a CSS pass.

Idempotent via a unique marker; safe to re-run.
"""
import re, glob, colorsys

MARK = "/* THEME-TEXT-FIX-V2 */"
LITERAL = "#c6cddb"

def hex_to_rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i+2], 16) / 255.0 for i in (0, 2, 4))

def rgb_to_hex(rgb):
    return "#%02x%02x%02x" % tuple(max(0, min(255, round(c * 255))) for c in rgb)

def luminance(rgb):
    def f(c): return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    r, g, b = (f(c) for c in rgb)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b

def contrast(hex1, rgb2):
    l1, l2 = luminance(hex_to_rgb(hex1)), luminance(rgb2)
    l1, l2 = max(l1, l2), min(l1, l2)
    return (l1 + 0.05) / (l2 + 0.05)

WHITE = (1.0, 1.0, 1.0)

def darken_for_light(hexcolor, target=4.5, min_l=0.20):
    r, g, b = hex_to_rgb(hexcolor)
    h, l, s = colorsys.rgb_to_hls(r, g, b)
    L = l
    while L >= min_l:
        rr, gg, bb = colorsys.hls_to_rgb(h, L, min(1.0, s * 1.05))
        if contrast(rgb_to_hex((rr, gg, bb)), WHITE) >= target:
            return rgb_to_hex((rr, gg, bb))
        L -= 0.01
    rr, gg, bb = colorsys.hls_to_rgb(h, min_l, s)
    return rgb_to_hex((rr, gg, bb))

BODY_LIGHT = darken_for_light(LITERAL)  # computed once, same everywhere

CANVAS_RULE = 'html[data-theme="light"] canvas{background:#0b0e15 !important;}'

def process(path):
    src = open(path, encoding="utf-8").read()
    if MARK in src:
        return False

    style_blocks = list(re.finditer(r'<style>.*?</style>', src, re.S))
    if not style_blocks:
        return False

    # only rewrite the literal inside <style> blocks; leave <script> alone
    def rewrite_style(m):
        return m.group(0).replace(LITERAL, "var(--body)")
    new_src = re.sub(r'<style>.*?</style>', rewrite_style, src, flags=re.S)
    if new_src == src and LITERAL not in src:
        # nothing to fix in this file (shouldn't happen for our glob, but be safe)
        pass
    src = new_src

    # 1. declare --body in the dark :root block (pixel-identical default)
    def add_to_root(m):
        body = m.group(1)
        if "--body" in body:
            return m.group(0)
        return ":root {" + body.rstrip() + f" --body:{LITERAL};" + "}"
    src = re.sub(r':root\s*\{([^}]*)\}', add_to_root, src, count=1, flags=re.S)

    # 2. declare --body + canvas-dark rule in the light override block
    #    (html[data-theme="light"] { ... } written by _build_theme.py)
    def add_to_light(m):
        block = m.group(0)
        if "--body" in block:
            return block
        return block[:-1].rstrip() + f" --body:{BODY_LIGHT};" + "}"
    new_src2, n = re.subn(r'html\[data-theme="light"\]\s*\{[^}]*\}', add_to_light, src, count=1, flags=re.S)
    if n:
        src = new_src2
        # insert the canvas rule + our marker right after that block
        src = re.sub(
            r'(html\[data-theme="light"\]\s*\{[^}]*\})',
            r'\1\n  ' + MARK + '\n  ' + CANVAS_RULE,
            src, count=1, flags=re.S
        )
    else:
        return False  # no light block found -- shouldn't happen post _build_theme.py

    open(path, "w", encoding="utf-8").write(src)
    return True

def main():
    patterns = ["pg-*.html", "kafka-*.html", "rmq-*.html", "wa-*.html",
                "bc-*.html", "btc-*.html", "ctr-*.html", "crypto-*.html",
                "k8s-*.html", "rust-*.html", "uber-*.html", "nflx-*.html"]
    files = sorted(set(f for p in patterns for f in glob.glob(p)))
    n_changed = 0
    for f in files:
        if process(f):
            n_changed += 1
    print(f"processed {len(files)} files, updated {n_changed}")
    print("light-mode --body value:", BODY_LIGHT)

if __name__ == "__main__":
    main()
