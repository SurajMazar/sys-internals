#!/usr/bin/env python3
"""Inject inter-chapter navigation into every lesson file."""
import re, glob, os, json

COURSES = {
 "pg": {
  "name":"PostgreSQL Internals","page":"course-postgresql.html","accent":"#60a5fa","prefix":"pg-",
  "ch":["Genesis: History & the Process Model",
        "Memory Internals: Contexts, palloc & Shared Memory",
        "The Page: On-Disk Layout, Byte by Byte",
        "Heap Storage: Segments, FSM, Visibility Map & TOAST",
        "MVCC I: Tuple Versions, Snapshots & Visibility",
        "MVCC II: HOT Updates, Freezing & XID Wraparound",
        "Transactions & Isolation: From Read Committed to SSI",
        "The Lock Manager: Heavyweight, LWLocks & Spinlocks",
        "Buffer Manager & the Clock-Sweep Algorithm",
        "WAL: The Physics of Durability",
        "Checkpoints & Crash Recovery",
        "VACUUM, Autovacuum & the Anatomy of Bloat",
        "B-Tree Internals: Lehman & Yao in Production",
        "Beyond B-Tree: GIN, GiST, SP-GiST, BRIN & Hash",
        "Query Pipeline I: Parser, Analyzer & Rewriter",
        "Query Pipeline II: The Cost-Based Planner",
        "The Executor: Volcano Model, Parallel Query & JIT",
        "Replication: Streaming, Logical & Slots",
        "Connections, Partitioning & Extensibility",
        "Production Engineering: Incidents, Profiling & Tuning",
        "Capstone: Build a Mini PostgreSQL"]},
 "kafka": {
  "name":"Apache Kafka Internals","page":"course-kafka.html","accent":"#f25c54","prefix":"kafka-",
  "ch":["Genesis: Why a Log, Not a Queue",
        "Broker Architecture & the Request Pipeline",
        "Log Internals: Segments, Indexes & the Record Format",
        "Producer Internals: Batching, Compression & Idempotence",
        "Replication: ISR, High Watermark & Leader Epochs",
        "The Controller: From ZooKeeper to KRaft",
        "Consumer Groups & Rebalancing",
        "Offsets & Delivery Semantics",
        "Transactions & Exactly-Once",
        "Storage Performance: Page Cache, Zero-Copy & Sequential I/O",
        "Retention & Log Compaction",
        "Networking & the Wire Protocol",
        "Performance Tuning & Cluster Sizing",
        "Production Incidents & Failure Handling",
        "Capstone: Build a Mini Kafka"]},
 "rmq": {
  "name":"RabbitMQ Internals","page":"course-rabbitmq.html","accent":"#ff9f43","prefix":"rmq-",
  "ch":["Genesis: AMQP & Why Erlang",
        "Connections, Channels & the Frame Protocol",
        "Exchanges, Bindings & Routing Algorithms",
        "Classic Queues: The Queue Process Internals",
        "Delivery: ACK, NACK, Confirms & Prefetch",
        "Quorum Queues: Raft Inside the Broker",
        "Streams: The Log Comes to RabbitMQ",
        "Dead Lettering, TTL & Priority Queues",
        "Flow Control & Memory Management",
        "Clustering, Federation & Shovel",
        "Persistence, Disk Layout & Recovery",
        "Capstone: Mini Broker + Kafka vs RabbitMQ, Settled"]},
 "wa": {
  "name":"WhatsApp Architecture","page":"course-whatsapp.html","accent":"#4ade80","prefix":"wa-",
  "ch":["Genesis: 50 Engineers, A Billion Users",
        "The Connection Layer: 2M Sockets Per Server",
        "Signal Protocol I: X3DH Key Agreement",
        "Signal Protocol II: The Double Ratchet",
        "The Message Delivery Pipeline",
        "Group Messaging & Sender Keys",
        "The Media Pipeline: Blobs the Server Can't Read",
        "Presence, Typing & Read Receipts at Scale",
        "Multi-Device: Sessions Without a Phone Proxy",
        "Storage: Mnesia, Sharding & Deleting Everything",
        "Reliability at Scale: LB, Failover, Spam & Observability",
        "Capstone: Design a Mini WhatsApp"]},
}

NAV_CSS = """
/* ===== injected inter-chapter navigation ===== */
#chapnav{position:fixed;left:0;right:0;bottom:0;z-index:120;display:flex;align-items:center;gap:10px;
  padding:9px 16px;background:rgba(11,14,21,.93);backdrop-filter:blur(18px) saturate(1.3);
  border-top:1px solid var(--border);font-family:var(--sans)}
#chapnav .cn-btn{display:inline-flex;align-items:center;gap:7px;text-decoration:none;color:var(--muted);
  border:1px solid var(--border);background:var(--panel);border-radius:10px;padding:7px 13px;font-size:12.5px;
  font-weight:550;transition:all .16s;white-space:nowrap;max-width:34vw;overflow:hidden;text-overflow:ellipsis}
#chapnav .cn-btn:hover{color:var(--text);border-color:var(--cn-accent);transform:translateY(-1px)}
#chapnav .cn-btn.disabled{opacity:.3;pointer-events:none}
#chapnav .cn-btn .cn-lbl{color:var(--dim);font-family:var(--mono);font-size:9.5px;letter-spacing:.1em;display:block}
#chapnav .cn-btn .cn-ttl{display:block;font-size:12.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#chapnav .cn-mid{flex:1;display:flex;align-items:center;gap:9px;justify-content:center;min-width:0}
#chapnav select{background:var(--panel);color:var(--text);border:1px solid var(--border);border-radius:10px;
  padding:7px 11px;font-size:12.5px;font-family:var(--sans);max-width:min(480px,45vw);cursor:pointer;outline:none}
#chapnav select:hover{border-color:var(--cn-accent)}
#chapnav .cn-home{color:var(--muted);text-decoration:none;font-size:12.5px;padding:7px 11px;border-radius:10px;
  border:1px solid var(--border);background:var(--panel);transition:all .16s;white-space:nowrap}
#chapnav .cn-home:hover{color:var(--text);border-color:var(--cn-accent)}
#chapnav .cn-prog{font-family:var(--mono);font-size:10.5px;color:var(--dim);white-space:nowrap}
body{padding-bottom:64px}
@media(max-width:820px){
  #chapnav .cn-btn .cn-ttl{display:none}
  #chapnav select{max-width:52vw}
  #chapnav .cn-prog{display:none}
}
"""

def nav_html(key, idx):
    c = COURSES[key]; n = len(c["ch"])
    def fid(i): return "%s%02d.html" % (c["prefix"], i+1)
    prev_i, next_i = idx-1, idx+1
    if prev_i >= 0:
        prev = '<a class="cn-btn" href="%s"><span>←</span><span><span class="cn-lbl">PREV · CH %02d</span><span class="cn-ttl">%s</span></span></a>' % (fid(prev_i), prev_i+1, c["ch"][prev_i])
    else:
        prev = '<a class="cn-btn disabled"><span>←</span><span><span class="cn-lbl">START</span><span class="cn-ttl">First chapter</span></span></a>'
    if next_i < n:
        nxt = '<a class="cn-btn" href="%s"><span><span class="cn-lbl">NEXT · CH %02d</span><span class="cn-ttl">%s</span></span><span>→</span></a>' % (fid(next_i), next_i+1, c["ch"][next_i])
    else:
        nxt = '<a class="cn-btn disabled"><span><span class="cn-lbl">END</span><span class="cn-ttl">Course complete</span></span><span>→</span></a>'
    opts = "".join('<option value="%s"%s>CH %02d · %s</option>' % (fid(i), " selected" if i==idx else "", i+1, t)
                   for i, t in enumerate(c["ch"]))
    return ('<div id="chapnav" style="--cn-accent:%s">%s'
            '<div class="cn-mid"><a class="cn-home" href="%s">☰ %s</a>'
            '<select id="cn-sel" aria-label="Jump to chapter">%s</select>'
            '<span class="cn-prog">%02d / %02d</span></div>%s</div>'
            '<script>(function(){var s=document.getElementById("cn-sel");'
            's.addEventListener("change",function(){location.href=s.value});'
            'document.addEventListener("keydown",function(e){'
            'if(e.metaKey||e.ctrlKey||e.altKey)return;'
            'var t=e.target.tagName;if(t==="INPUT"||t==="TEXTAREA"||t==="SELECT")return;'
            'if(e.key==="[")  {var p=document.querySelector("#chapnav .cn-btn:not(.disabled)");'
            'var a=document.querySelectorAll("#chapnav a.cn-btn");if(a[0]&&a[0].href)location.href=a[0].href;}'
            'if(e.key==="]"){var a=document.querySelectorAll("#chapnav a.cn-btn");'
            'if(a[1]&&a[1].href)location.href=a[1].href;}});})();</script>'
            ) % (c["accent"], prev, c["page"], c["name"], opts, idx+1, len(c["ch"]), nxt)

count = 0
for key, c in COURSES.items():
    for i in range(len(c["ch"])):
        fn = "%s%02d.html" % (c["prefix"], i+1)
        if not os.path.exists(fn):
            print("MISSING", fn); continue
        h = open(fn, encoding="utf-8").read()
        # idempotent: strip any previous injection
        h = re.sub(r'<div id="chapnav".*?</script>\s*(?=</body>)', '', h, flags=re.S)
        h = h.replace(NAV_CSS, "")
        # point the topbar "Hub" link at the course page
        h = h.replace('href="index.html">← Hub<', 'href="%s">← %s<' % (c["page"], c["name"]))
        # inject CSS at end of the first <style> block
        h = h.replace("</style>", NAV_CSS + "</style>", 1)
        # inject nav just before </body>
        h = h.replace("</body>", nav_html(key, i) + "\n</body>", 1)
        open(fn, "w", encoding="utf-8").write(h)
        count += 1
print("injected nav into", count, "chapters")
