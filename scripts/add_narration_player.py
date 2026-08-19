#!/usr/bin/env python3
"""
Add the "listen to this chapter" narration player scaffold to a chapter HTML
file: the player CSS, the stepper() controller-return change (+ window.__decks
registry), each deck's call site wired into that registry, and the player's
own HTML/JS block. This is the mechanical part of what was hand-applied to
uber-01.html — pulled out into a script so it can be reapplied identically to
every chapter, since every uber-*.html file shares the exact same stepper()
function body and .widget.deck markup (verified byte-identical across all 18
chapters before writing this).

Idempotent: each piece is skipped if already present, so re-running is safe.
Does NOT touch narration content — run scripts/extract_cues.py and
scripts/synthesize_narration.py afterward (or scripts/narrate-chapter.sh for
all three steps at once) to actually populate cues/audio/manifest.

Usage: python3 scripts/add_narration_player.py uber-02
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

STEPPER_OLD = """  prev.onclick = ()=>go(i-1);
  next.onclick = ()=>go(i+1);
  go(0);
}"""

STEPPER_NEW = """  prev.onclick = ()=>go(i-1);
  next.onclick = ()=>go(i+1);
  go(0);
  return { go, get index(){ return i; }, get length(){ return steps.length; } };
}
window.__decks = {};"""

CSS_BLOCK = """
/* ===== listen-to-this-chapter narration player ===== */
#narrate-player{position:fixed;right:18px;bottom:74px;z-index:130;display:none;align-items:center;gap:10px;
  background:var(--panel);border:1px solid var(--border-hi);border-radius:999px;padding:8px 14px 8px 8px;
  box-shadow:0 12px 40px rgba(0,0,0,.35)}
#narrate-player .np-btn{width:32px;height:32px;flex:0 0 32px;border-radius:50%;border:1px solid var(--border-hi);
  background:var(--panel-2);color:var(--text);cursor:pointer;display:flex;align-items:center;justify-content:center;
  font-size:12px;padding:0;line-height:1;transition:all .15s}
#narrate-player .np-btn:hover{border-color:var(--pg);color:var(--pg)}
#narrate-player .np-btn.play{background:var(--pg);border-color:var(--pg);color:#04150d}
#narrate-player .np-label{font-family:var(--mono);font-size:10.5px;color:var(--muted);min-width:56px;text-align:center}
#narrate-player .np-bar{width:80px;height:3px;border-radius:2px;background:var(--border);overflow:hidden}
#narrate-player .np-fill{height:100%;background:var(--pg);width:0%}
.narrate-highlight{outline:2px solid var(--pg);outline-offset:8px;border-radius:10px;background:var(--pg-dim)}
[data-cue]{cursor:pointer;border-radius:10px;transition:background .15s}
[data-cue]:hover{background:var(--pg-dim)}
.widget.deck{cursor:pointer}
@media(max-width:820px){#narrate-player{right:10px;bottom:78px;padding:6px 10px 6px 6px;gap:7px}
  #narrate-player .np-bar{width:44px}}
</style>"""

PLAYER_BLOCK = """
<!-- ===== listen-to-this-chapter narration player ===== -->
<div id="narrate-player" aria-label="Listen to this chapter">
  <button class="np-btn" id="np-prev" title="Previous cue">⏮</button>
  <button class="np-btn play" id="np-playpause" title="Play narration">▶</button>
  <button class="np-btn" id="np-next" title="Next cue">⏭</button>
  <span class="np-label" id="np-label">Listen</span>
  <div class="np-bar"><div class="np-fill" id="np-fill"></div></div>
</div>
<script>
(function(){
  "use strict";
  function init(){
  var manifestEl = document.getElementById("narration-manifest");
  if (!manifestEl) return; // narration not yet synthesized for this chapter — player stays hidden
  var manifest;
  try { manifest = JSON.parse(manifestEl.textContent); } catch (e) { return; }
  var cues = manifest.cues || [];
  if (!cues.length) return;

  var player = document.getElementById("narrate-player");
  var playBtn = document.getElementById("np-playpause");
  var label = document.getElementById("np-label");
  var fill = document.getElementById("np-fill");
  player.style.display = "flex";

  var idx = -1, playing = false, highlightEl = null;
  var audio = new Audio();

  function clearHighlight(){
    if (highlightEl){ highlightEl.classList.remove("narrate-highlight"); highlightEl = null; }
  }

  function targetFor(cue){
    return cue.kind === "deck" ? document.getElementById(cue.deckId) : document.querySelector(cue.selector);
  }

  function playCue(i){
    if (i < 0 || i >= cues.length){ stop(); return; }
    idx = i;
    var cue = cues[idx];
    clearHighlight();
    var t = targetFor(cue);
    if (t){
      t.scrollIntoView({ behavior: "smooth", block: "center" });
      if (cue.kind === "text"){ t.classList.add("narrate-highlight"); highlightEl = t; }
    }
    if (cue.kind === "deck" && window.__decks && window.__decks[cue.deckId]){
      window.__decks[cue.deckId].go(cue.step);
    }
    label.textContent = (idx + 1) + " / " + cues.length;
    fill.style.width = "0%";
    audio.src = cue.src;
    audio.currentTime = 0;
    audio.play().catch(function(){});
  }

  audio.addEventListener("ended", function(){
    if (playing) setTimeout(function(){ playCue(idx + 1); }, 350);
  });
  audio.addEventListener("timeupdate", function(){
    if (audio.duration) fill.style.width = (audio.currentTime / audio.duration * 100) + "%";
  });

  function play(){
    playing = true; playBtn.textContent = "⏸"; playBtn.title = "Pause"; playBtn.classList.add("play");
    if (idx < 0) playCue(0); else audio.play().catch(function(){});
  }
  function pause(){
    playing = false; playBtn.textContent = "▶"; playBtn.title = "Play narration"; playBtn.classList.add("play");
    audio.pause();
  }
  function stop(){
    pause(); idx = -1; clearHighlight(); label.textContent = "Listen"; fill.style.width = "0%";
  }

  function jumpTo(i){
    playing = true; playBtn.textContent = "⏸"; playBtn.title = "Pause"; playBtn.classList.add("play");
    playCue(i);
  }

  playBtn.onclick = function(){ playing ? pause() : play(); };
  document.getElementById("np-next").onclick = function(){ playCue(Math.min(idx + 1, cues.length - 1)); };
  document.getElementById("np-prev").onclick = function(){ playCue(Math.max(idx - 1, 0)); };

  // click any narrated paragraph/list/callout to jump narration there and resume playing
  cues.forEach(function(cue, i){
    if (cue.kind !== "text") return;
    var t = document.querySelector(cue.selector);
    if (t) t.addEventListener("click", function(){ jumpTo(i); });
  });

  // click a deck widget (anywhere outside its own prev/next/dot controls) to jump
  // narration to whichever step it's currently showing
  var deckStepCue = {};
  cues.forEach(function(cue, i){
    if (cue.kind === "deck") deckStepCue[cue.deckId + "::" + cue.step] = i;
  });
  document.querySelectorAll(".widget.deck[id]").forEach(function(deckRoot){
    var deckId = deckRoot.id;
    deckRoot.addEventListener("click", function(){
      setTimeout(function(){
        var ctl = window.__decks && window.__decks[deckId];
        if (!ctl) return;
        var i = deckStepCue[deckId + "::" + ctl.index];
        if (i !== undefined) jumpTo(i);
      }, 160); // stepper()'s own go() updates state after a 120ms transition
    });
  });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
</script>

</body>"""


def add_scaffold(chapter):
    html_path = ROOT / f"{chapter}.html"
    source = html_path.read_text()
    changed = False

    if "#narrate-player{" not in source:
        idx = source.index("</style>")
        source = source[:idx] + CSS_BLOCK.lstrip("\n") + source[idx + len("</style>"):]
        changed = True
    else:
        print(f"  [{chapter}] player CSS already present, skipping")

    if "window.__decks = {}" not in source:
        if STEPPER_OLD not in source:
            raise SystemExit(f"  [{chapter}] stepper() function body doesn't match the expected template — "
                              f"skipping stepper wiring, needs manual check")
        source = source.replace(STEPPER_OLD, STEPPER_NEW, 1)
        changed = True
    else:
        print(f"  [{chapter}] stepper() controller wiring already present, skipping")

    deck_ids = re.findall(r'<div class="widget deck" id="([a-zA-Z0-9]+)"', source)
    for deck_id in deck_ids:
        already_wired = re.search(r"window\.__decks\." + re.escape(deck_id) + r"\s*=\s*stepper\(", source)
        if already_wired:
            continue
        pattern = re.compile(r'stepper\(\s*["\']' + re.escape(deck_id) + r'["\']')
        new_source, n = pattern.subn(lambda m: f"window.__decks.{deck_id} = " + m.group(0), source, count=1)
        if n == 0:
            print(f'  [{chapter}] warning: could not find stepper("{deck_id}", ...) call site to wire', file=sys.stderr)
            continue
        source = new_source
        changed = True

    if 'id="narrate-player"' not in source:
        idx = source.rindex("</body>")
        source = source[:idx] + PLAYER_BLOCK.lstrip("\n")[:-len("</body>")] + source[idx:]
        changed = True
    else:
        print(f"  [{chapter}] player HTML/JS already present, skipping")

    if changed:
        html_path.write_text(source)
        print(f"  [{chapter}] scaffold applied")
    else:
        print(f"  [{chapter}] nothing to do, already fully scaffolded")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("usage: add_narration_player.py <chapter-id>", file=sys.stderr)
        sys.exit(1)
    add_scaffold(sys.argv[1])
