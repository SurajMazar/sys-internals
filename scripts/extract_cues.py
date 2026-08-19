#!/usr/bin/env python3
"""
Extract narration cues from a course chapter's HTML for the "listen to this
chapter" feature: auto-scrolling, auto-advancing TTS narration driven by
Kokoro (see scripts/synthesize_narration.py for the next step).

Walks <chapter>.html and emits assets/audio/<chapter>/cues.json, an ordered
list of narratable text blocks (prose paragraphs, plain lists, callouts, the
hero's lead/objectives, and each stepper deck's existing step captions).
Interactive widgets (quizzes, sliders, the timeline, code blocks, tables,
canvases) are deliberately excluded — they stay visual-only.

Deck widgets (<div class="widget deck" id="...">) are discovered directly from
the HTML — nothing about deck ids, count, or section placement is hardcoded —
so this script works unmodified across chapters whose decks differ entirely
(different ids, different sections, 2 or 3 decks, etc.). Each deck's step
captions are recovered from its own `stepper("deckId", [...])` call in the
<script> block, located generically (no comment-header anchors required).

As a side effect, it injects a stable data-cue="..." attribute onto each
narrated *text* element (deck cues need no injection; they target the deck's
existing id) so the client-side player can find things at runtime without
fragile structural selectors. This step is idempotent — safe to re-run any
number of times; it strips previously-injected attributes before recomputing.

Usage: python3 scripts/extract_cues.py uber-01
"""
import json
import re
import sys
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

CAP_RE = re.compile(r"cap:\s*`((?:\\.|(?!`).)*)`", re.S)

CAPTURING_KINDS = {"p", "list", "objectives"}

# HTML void elements: no closing tag in the source, so handle_endtag is never
# called for them. They must not push a stack frame, or every later
# handle_endtag call pops the wrong frame and the whole walk desyncs.
VOID_TAGS = {"input", "br", "hr", "img", "meta", "link", "source", "track",
             "wbr", "col", "area", "base", "embed", "param"}


def collapse(text):
    text = re.sub(r"\s+", " ", text.replace("\xa0", " ")).strip()
    # word-boundary spaces (inserted at every tag open/close so inline markup
    # doesn't glue words together) can land right before punctuation or right
    # after an opening bracket — tidy those up.
    text = re.sub(r"\s+([,.;:!?)])", r"\1", text)
    text = re.sub(r"([(\[])\s+", r"\1", text)
    return text


def find_iife_spans(source):
    """
    Returns [(start, end), ...] byte offsets for every top-level
    `(function(){ ... })();` block, found by counting braces from each
    opening `{`. Assumes (true across this site's chapters) that no cap:
    string or comment contains an unmatched brace — good enough for a
    same-repo authoring convention, not a general JS parser.
    """
    spans = []
    n = len(source)
    for m in re.finditer(r"\(function\(\)\{", source):
        depth = 0
        j = m.end() - 1  # position of the opening '{' itself
        while j < n:
            c = source[j]
            if c == "{":
                depth += 1
            elif c == "}":
                depth -= 1
                if depth == 0:
                    break
            j += 1
        spans.append((m.start(), j + 1))
    return spans


def extract_deck_caps(source, deck_ids):
    """
    Returns {deckId: [cap_text, ...]}, one entry per deck id actually found.
    Each deck's cap texts are pulled from the *entire enclosing IIFE* that
    contains its stepper("deckId", ...) call — not just text following that
    call — because some decks pass a `steps` variable declared earlier in the
    same IIFE rather than an inline array literal. Confirmed (by inspection,
    across every uber-* chapter) that each deck always gets its own dedicated
    IIFE, so this scoping never mixes one deck's captions into another's.
    """
    iife_spans = find_iife_spans(source)
    out = {}
    for deck_id in deck_ids:
        m = re.search(r'stepper\(\s*["\']' + re.escape(deck_id) + r'["\']', source)
        if not m:
            print(f'  warning: no stepper("{deck_id}", ...) call found — skipping its narration', file=sys.stderr)
            continue
        call_pos = m.start()
        containing = [(s, e) for s, e in iife_spans if s <= call_pos < e]
        span_start, span_end = min(containing, key=lambda se: se[1] - se[0]) if containing else (call_pos, len(source))
        span = source[span_start:span_end]
        caps = []
        for cm in CAP_RE.finditer(span):
            raw = cm.group(1).replace("\\`", "`").replace("\\\\", "\\")
            caps.append(collapse(re.sub(r"<[^>]+>", " ", raw)))
        if not caps:
            print(f'  warning: stepper("{deck_id}", ...) found but no cap: `...` templates in its enclosing block — skipping', file=sys.stderr)
            continue
        out[deck_id] = caps
    return out


class CueWalker(HTMLParser):
    """
    Whitelist DOM walker: only <p>, <ul class="plain">, .callout (via its
    child <p>s), the hero .objectives div, and deck widgets
    (<div class="widget deck" id="...">) ever produce a cue. Everything else
    (code blocks, tables, other widgets, canvases, the quiz/order-quiz/live
    sim) is ignored by construction — it's simply never one of these kinds.

    Tracks byte offsets of each text cue's opening tag so the caller can
    splice data-cue="..." attributes into the original source without
    re-serializing (keeps the diff surgical). Deck markers need no offset —
    they target the deck's own existing id — and are recorded in document
    order exactly where their widget div opens.
    """

    def __init__(self, source):
        super().__init__(convert_charrefs=True)
        self.lines = source.splitlines(keepends=True)
        offsets = [0]
        for line in self.lines:
            offsets.append(offsets[-1] + len(line))
        self.line_offsets = offsets

        self.stack = []
        self.cues = []  # [{'id','text'}] or [{'kind':'deck_marker','deckId':...}], in document order
        self.injections = []  # [(offset_after_tagname, cue_id)]
        self.in_main = False
        self.section_id = None
        self.counts = {}  # section_id -> {'p':n,'list':n,'co':n}

    def _offset(self):
        lineno, col = self.getpos()
        return self.line_offsets[lineno - 1] + col

    def _nearest_special(self):
        for frame in reversed(self.stack):
            if frame["kind"] in ("codeblock", "table", "widget", "callout"):
                return frame
        return None

    def _cue_id(self, kind):
        if self.section_id == "hero":
            return "hero-lead" if kind == "p" else "hero-obj"
        counts = self.counts.setdefault(self.section_id, {"p": 0, "list": 0, "co": 0})
        counts[kind] += 1
        prefix = {"p": "p", "list": "list", "co": "co"}[kind]
        return f"{self.section_id}-{prefix}{counts[kind]}"

    def _feed_nearest_capturing(self, text):
        for frame in reversed(self.stack):
            if frame["kind"] in CAPTURING_KINDS:
                frame["text"].append(text)
                return

    def handle_starttag(self, tag, attrs):
        if tag in VOID_TAGS:
            self._feed_nearest_capturing(" ")
            return

        d = dict(attrs)
        classes = (d.get("class") or "").split()
        elem_id = d.get("id")

        if tag == "main":
            self.in_main = True
        if self.in_main:
            if tag == "div" and "hero" in classes:
                self.section_id = "hero"
            elif tag == "section" and elem_id and re.fullmatch(r"s\d+", elem_id):
                self.section_id = elem_id

        # insert a word-boundary space so adjacent inline elements (e.g.
        # <b>label</b>rest-of-sentence with no literal space in the source)
        # don't get glued together; harmless extra spaces collapse later.
        self._feed_nearest_capturing(" ")

        frame = {"tag": tag, "kind": None, "text": [], "cue_id": None,
                 "tag_start": self._offset(), "belongs_to_callout": None, "parts": None}

        if self.in_main:
            special = self._nearest_special()
            if tag == "pre" or (tag == "div" and "codeblock" in classes):
                frame["kind"] = "codeblock"
            elif tag == "table":
                frame["kind"] = "table"
            elif tag == "div" and "widget" in classes:
                frame["kind"] = "widget"
                if "deck" in classes and elem_id:
                    self.cues.append({"kind": "deck_marker", "deckId": elem_id})
            elif tag == "div" and "callout" in classes:
                frame["kind"] = "callout"
                frame["cue_id"] = self._cue_id("co")
                frame["parts"] = []
            elif tag == "div" and "objectives" in classes and self.section_id == "hero":
                frame["kind"] = "objectives"
                frame["cue_id"] = self._cue_id("list")
            elif tag == "ul" and "plain" in classes and special is None:
                frame["kind"] = "list"
                frame["cue_id"] = self._cue_id("list")
            elif tag == "p":
                if special is None:
                    frame["kind"] = "p"
                    frame["cue_id"] = self._cue_id("p")
                elif special["kind"] == "callout":
                    frame["kind"] = "p"
                    frame["belongs_to_callout"] = special

        self.stack.append(frame)

    def handle_data(self, data):
        self._feed_nearest_capturing(data)

    def handle_endtag(self, tag):
        if not self.stack:
            return
        frame = self.stack.pop()
        self._feed_nearest_capturing(" ")
        kind = frame["kind"]

        if kind in ("p", "list", "objectives"):
            text = collapse("".join(frame["text"]))
            if frame["belongs_to_callout"] is not None:
                if text:
                    frame["belongs_to_callout"]["parts"].append(text)
            elif text and frame["cue_id"]:
                self.cues.append({"id": frame["cue_id"], "text": text})
                self.injections.append((frame["tag_start"] + 1 + len(frame["tag"]), frame["cue_id"]))
        elif kind == "callout":
            text = collapse(" ".join(frame["parts"] or []))
            if text:
                self.cues.append({"id": frame["cue_id"], "text": text})
                self.injections.append((frame["tag_start"] + 1 + len(frame["tag"]), frame["cue_id"]))


def strip_existing_data_cue(source):
    return re.sub(r'\s+data-cue="[^"]*"', "", source)


def inject_data_cue(source, injections):
    # splice from highest offset to lowest so earlier offsets stay valid
    for offset, cue_id in sorted(injections, key=lambda x: -x[0]):
        source = source[:offset] + f' data-cue="{cue_id}"' + source[offset:]
    return source


def main():
    if len(sys.argv) != 2:
        print("usage: extract_cues.py <chapter-id>", file=sys.stderr)
        sys.exit(1)
    chapter = sys.argv[1]
    html_path = ROOT / f"{chapter}.html"
    source = strip_existing_data_cue(html_path.read_text())

    walker = CueWalker(source)
    walker.feed(source)
    walker.close()

    new_source = inject_data_cue(source, walker.injections)
    html_path.write_text(new_source)

    deck_ids = [c["deckId"] for c in walker.cues if c.get("kind") == "deck_marker"]
    deck_caps = extract_deck_caps(new_source, deck_ids)

    final_cues = []
    for cue in walker.cues:
        if cue.get("kind") == "deck_marker":
            caps = deck_caps.get(cue["deckId"])
            if not caps:
                continue
            for step, cap_text in enumerate(caps):
                final_cues.append({"id": f'deck-{cue["deckId"]}-{step}', "kind": "deck",
                                    "deckId": cue["deckId"], "step": step, "text": cap_text})
        else:
            final_cues.append({"id": cue["id"], "kind": "text",
                                "selector": f'[data-cue="{cue["id"]}"]', "text": cue["text"]})

    out_dir = ROOT / "assets" / "audio" / chapter
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "cues.json").write_text(json.dumps(final_cues, indent=2))
    print(f"Wrote {len(final_cues)} cues ({len(deck_caps)} deck(s) narrated) to {out_dir / 'cues.json'}")


if __name__ == "__main__":
    main()
