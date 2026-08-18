#!/usr/bin/env python3
"""
Inject a persistent light/dark theme toggle into every self-contained chapter
and lab HTML file (each ships its own embedded <style> :root block with a
consistent set of variable names — --bg/--bg-2/--panel/--panel-2/--border/
--border-hi/--text/--muted/--dim plus per-course accent vars like --pg/--pg2/
--purple/--indigo/--amber/--ok/--warn/--bad).

Idempotent: safe to re-run. Each injected piece is guarded by a unique marker
comment; re-running only touches files that are missing a piece.

Usage: python3 _build_theme.py
"""
import re, glob, colorsys, sys

MARK_HEAD   = "<!-- THEME-EARLY -->"
MARK_STYLE  = "/* THEME-LIGHT-OVERRIDE */"
MARK_BTN    = "<!-- THEME-BTN -->"

# ---------- colour math: darken any accent hex enough to read on a light bg ----------
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

_darken_cache = {}
def darkened(hexcolor):
    hexcolor = hexcolor.lower()
    if hexcolor not in _darken_cache:
        _darken_cache[hexcolor] = darken_for_light(hexcolor)
    return _darken_cache[hexcolor]

# fixed neutral palette shared by every file
NEUTRAL_LIGHT = {
    "--bg": "#f6f7fb", "--bg-2": "#ffffff", "--panel": "#ffffff", "--panel-2": "#eef0f5",
    "--border": "#dde2ec", "--border-hi": "#c3cbdc",
    "--text": "#12151c", "--muted": "#55606f", "--dim": "#7a8494",
}

VAR_RE = re.compile(r'(--[\w-]+)\s*:\s*([^;]+);')

def build_light_block(root_body, selector):
    """root_body: the raw text between the :root {' and its closing '}'."""
    out = {}
    for name, value in VAR_RE.findall(root_body):
        value = value.strip()
        if name in NEUTRAL_LIGHT:
            out[name] = NEUTRAL_LIGHT[name]
        elif name.endswith("-dim"):
            continue  # low-opacity rgba tints read fine over a light bg unchanged
        elif re.fullmatch(r'#[0-9a-fA-F]{6}', value):
            out[name] = darkened(value)
        # skip font stacks (--mono/--sans) and anything else non-color
    if not out:
        return None
    decls = " ".join(f"{k}:{v};" for k, v in out.items())
    extra = (f'{selector} #topbar{{background:rgba(255,255,255,.85);}}\n'
             f'  {selector} #chapnav{{background:rgba(255,255,255,.93);}}\n')
    return f"{MARK_STYLE}\n  {selector} {{ {decls} }}\n  {extra}"

BTN_CSS = """
  #theme-toggle{position:relative;display:inline-flex;align-items:center;justify-content:center;
    width:30px;height:30px;border-radius:8px;border:1px solid var(--border);background:var(--bg-2);
    color:var(--muted);cursor:pointer;font-size:14px;line-height:1;transition:all .15s;margin-left:6px}
  #theme-toggle:hover{color:var(--text);border-color:var(--border-hi)}
"""

BTN_HTML = '<button id="theme-toggle" title="Toggle light / dark" aria-label="Toggle light and dark theme">☀️</button>'

HEAD_SCRIPT = f'{MARK_HEAD}<script>(function(){{try{{var t=localStorage.getItem("sysinternals-theme");if(t==="light")document.documentElement.setAttribute("data-theme","light");}}catch(e){{}}}})();</script>'

BTN_SCRIPT = '''<script>(function(){
  var KEY="sysinternals-theme", btn=document.getElementById("theme-toggle");
  function sync(){ var light=document.documentElement.getAttribute("data-theme")==="light";
    if(btn) btn.textContent = light ? "\\ud83c\\udf19" : "\\u2600\\ufe0f"; }
  sync();
  if(btn) btn.onclick=function(){
    var light=document.documentElement.getAttribute("data-theme")==="light";
    if(light){ document.documentElement.removeAttribute("data-theme"); localStorage.setItem(KEY,"dark"); }
    else { document.documentElement.setAttribute("data-theme","light"); localStorage.setItem(KEY,"light"); }
    sync();
  };
})();</script>'''

def process_chapter(path):
    src = open(path, encoding="utf-8").read()
    changed = False

    # 1. earliest possible theme application, right after <head>
    if MARK_HEAD not in src:
        src = re.sub(r'(<head>)', r'\1' + HEAD_SCRIPT, src, count=1)
        changed = True

    # 2. light-mode CSS override, injected right after the :root {...} block
    if MARK_STYLE not in src:
        m = re.search(r':root\s*\{([^}]*)\}', src, re.S)
        if m:
            block = build_light_block(m.group(1), 'html[data-theme="light"]')
            if block:
                insert_at = m.end()
                src = src[:insert_at] + "\n" + BTN_CSS + "\n" + block + src[insert_at:]
                changed = True

    # 3. toggle button, injected into #topbar (before its closing </div>)
    if MARK_BTN not in src:
        m = re.search(r'(<div id="topbar">.*?)(</div>)', src, re.S)
        if m:
            btn_block = f'{MARK_BTN}{BTN_HTML}\n{BTN_SCRIPT}\n'
            src = src[:m.end(1)] + btn_block + src[m.end(1):]
            changed = True

    if changed:
        open(path, "w", encoding="utf-8").write(src)
    return changed

def main():
    patterns = ["pg-*.html", "kafka-*.html", "rmq-*.html", "wa-*.html",
                "bc-*.html", "btc-*.html", "ctr-*.html", "crypto-*.html",
                "k8s-*.html", "rust-*.html", "uber-*.html", "nflx-*.html"]
    files = sorted(set(f for p in patterns for f in glob.glob(p)))
    n_changed = 0
    for f in files:
        if process_chapter(f):
            n_changed += 1
    print(f"processed {len(files)} files, updated {n_changed}")

if __name__ == "__main__":
    main()
