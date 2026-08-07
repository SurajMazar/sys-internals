#!/usr/bin/env python3
"""
Make the site data-driven so future edits are cheap.

  data/site.js     <- SINGLE SOURCE OF TRUTH (courses, chapters, labs, availability)
  assets/site.css  <- all shared hub/course styling
  assets/site.js   <- renderer for landing + course pages, search, progress
  index.html       <- ~2 KB shell
  course-*.html    <- ~2 KB shells each

Adding a chapter / lab / whole course afterwards = edit data/site.js only.
"""
import re, os, json

os.makedirs("assets", exist_ok=True)
os.makedirs("data", exist_ok=True)

src = open("index.html", encoding="utf-8").read()
STYLE      = re.search(r"<style>(.*?)</style>", src, re.S).group(1)
CURRICULUM = re.search(r"const CURRICULUM = (\[.*?\n\]);", src, re.S).group(1)
FLOW       = re.search(r"const FLOW_STEPS = (\[.*?\]);", src, re.S).group(1)
AVAIL      = re.sub(r"\s+", " ", re.search(r"const AVAILABLE = new Set\((\[.*?\])\);", src, re.S).group(1))

# ---------------------------------------------------------------- data/site.js
open("data/site.js", "w", encoding="utf-8").write(f"""/* =====================================================================
   SITE DATA — the only file you need to edit to add content.
   Adding a chapter : append to the right course's `chapters` array,
                      then add its id to BUILT.
   Adding a lab     : append to LABS.
   Adding a course  : append to COURSES with a unique key + page filename.
   ===================================================================== */

const COURSES = {CURRICULUM};

const FLOW_STEPS = {FLOW};

/* Chapters whose lesson file exists. Anything absent renders as "not yet built". */
const BUILT = new Set({AVAIL});

/* Hands-on labs, keyed by course. */
const LABS = {{
  pg: {{ file: "pg-lab.html",
         title: "PostgreSQL Hands-On Lab",
         desc: "Docker cluster, 18 prove-the-internals experiments, config cookbook with reasoning, operational runbooks, and three build projects." }}
  /* kafka: {{ file:"kafka-lab.html", title:"…", desc:"…" }}, */
  /* wa:    {{ file:"wa-lab.html",    title:"…", desc:"…" }},  */
}};

/* Course key -> its page. Keep in sync with COURSES. */
const COURSE_PAGE = {{ pg:"course-postgresql.html", kafka:"course-kafka.html", wa:"course-whatsapp.html" }};
""")

# ---------------------------------------------------------------- assets/site.css
EXTRA = """
/* ---- landing / course-page additions ---- */
.topnav{position:fixed;top:0;left:0;right:0;z-index:100;display:flex;align-items:center;gap:6px;
  background:rgba(11,14,21,.86);backdrop-filter:blur(18px);border-bottom:1px solid var(--border);padding:10px 18px}
.topnav .brand{font-weight:700;font-size:13px;letter-spacing:.04em;text-decoration:none;color:var(--text);margin-right:10px}
.topnav .brand span{color:var(--pg)}
.topnav a.tl{color:var(--muted);text-decoration:none;font-size:12.5px;font-weight:500;padding:6px 11px;
  border-radius:9px;transition:all .16s;white-space:nowrap}
.topnav a.tl:hover,.topnav a.tl.on{color:var(--text);background:var(--panel-2)}
.topnav .sp{flex:1}
.coursecards{display:grid;grid-template-columns:repeat(auto-fit,minmax(310px,1fr));gap:16px;margin-top:26px}
.ccard{position:relative;display:block;text-decoration:none;color:inherit;background:var(--panel);
  border:1px solid var(--border);border-radius:18px;padding:24px;overflow:hidden;transition:all .24s cubic-bezier(.22,1,.36,1)}
.ccard:hover{transform:translateY(-5px);box-shadow:0 18px 50px rgba(0,0,0,.45);border-color:var(--ca)}
.ccard::before{content:"";position:absolute;inset:0 0 auto 0;height:3px;background:var(--ca)}
.ccard .cc-badge{font-family:var(--mono);font-size:10.5px;letter-spacing:.1em;color:var(--ca);margin-bottom:12px}
.ccard h3{font-size:22px;font-weight:750;letter-spacing:-.02em;margin-bottom:9px}
.ccard p{color:var(--muted);font-size:13.5px;line-height:1.65;margin-bottom:18px}
.ccard .cc-meta{display:flex;align-items:center;gap:14px;font-family:var(--mono);font-size:11px;color:var(--muted);flex-wrap:wrap}
.ccard .cc-bar{height:5px;border-radius:3px;background:var(--bg-2);overflow:hidden;margin:14px 0 8px;border:1px solid var(--border)}
.ccard .cc-fill{height:100%;background:var(--ca);width:0;transition:width .7s cubic-bezier(.22,1,.36,1)}
.ccard .cc-go{position:absolute;right:22px;bottom:22px;color:var(--ca);font-size:19px;opacity:0;transform:translateX(-6px);transition:all .24s}
.ccard:hover .cc-go{opacity:1;transform:none}
.ccard.soon{opacity:.45;pointer-events:none}
.labcard{display:flex;gap:16px;align-items:center;background:var(--panel);border:1px solid var(--border);
  border-radius:16px;padding:18px 22px;text-decoration:none;color:inherit;transition:all .2s;margin-top:12px}
.labcard:hover{border-color:var(--ca);transform:translateY(-3px)}
.labcard .li{width:42px;height:42px;border-radius:12px;background:color-mix(in srgb,var(--ca) 14%,transparent);
  display:flex;align-items:center;justify-content:center;font-size:19px;flex:0 0 auto}
.labcard .lt{font-size:15px;font-weight:650;margin-bottom:3px}
.labcard .ld{font-size:12.5px;color:var(--muted);line-height:1.5}
.sec-h{font-family:var(--mono);font-size:12px;color:var(--muted);letter-spacing:.1em;text-transform:uppercase;margin:52px 0 4px}
.sec-b{font-size:clamp(21px,3vw,28px);font-weight:750;letter-spacing:-.02em;margin-bottom:10px}
.sec-p{color:var(--muted);font-size:14.5px;line-height:1.7;max-width:760px;margin-bottom:8px}
.chero{padding:104px 0 8px}
.chero .cb{display:inline-flex;align-items:center;gap:8px;font-family:var(--mono);font-size:11px;
  color:var(--ca);border:1px solid color-mix(in srgb,var(--ca) 30%,transparent);
  background:color-mix(in srgb,var(--ca) 7%,transparent);padding:5px 13px;border-radius:999px;margin-bottom:18px}
.chero h1{font-size:clamp(30px,5vw,50px);font-weight:800;letter-spacing:-.03em;line-height:1.06;margin-bottom:18px;color:var(--ca)}
.chero p.sub{color:var(--muted);font-size:15.5px;line-height:1.7;max-width:720px;margin-bottom:26px}
.cstats{display:flex;gap:10px;flex-wrap:wrap}
.cstat{background:var(--panel);border:1px solid var(--border);border-radius:12px;padding:12px 18px;min-width:104px}
.cstat .n{font-family:var(--mono);font-size:21px;font-weight:700;color:var(--ca)}
.cstat .l{font-size:10.5px;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-top:2px}
main.page{max-width:1160px;margin:0 auto;padding:0 24px 120px}
header.landing{position:relative;min-height:auto;padding:128px 24px 30px;text-align:center;overflow:hidden;
  display:flex;flex-direction:column;justify-content:center;align-items:center}
"""
open("assets/site.css","w",encoding="utf-8").write(STYLE + EXTRA)

# ---------------------------------------------------------------- assets/site.js
open("assets/site.js","w",encoding="utf-8").write(r"""
/* Shared renderer for the landing page and every course page.
   Reads everything from data/site.js — no content lives here. */
"use strict";
const $ = id => document.getElementById(id);
const LS_KEY = "sysinternals-progress-v1";
let progress = {}; try { progress = JSON.parse(localStorage.getItem(LS_KEY)) || {}; } catch(e){}
const saveProgress = () => localStorage.setItem(LS_KEY, JSON.stringify(progress));
const CHECK = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#07090d" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';

/* ---------- chrome: topnav + search overlay, injected once ---------- */
function chrome(activeKey){
  document.body.insertAdjacentHTML("afterbegin",
    `<div class="topnav"><a class="brand" href="index.html">SYS/<span>INTERNALS</span></a>` +
    COURSES.map(c=>`<a class="tl${c.key===activeKey?" on":""}" href="${COURSE_PAGE[c.key]}">${c.name.split(" ")[0]}</a>`).join("") +
    `<span class="sp"></span><div class="searchbtn" id="searchbtn">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
      Search <span class="kbd">/</span></div></div>`);
  document.body.insertAdjacentHTML("beforeend",
    `<div id="search-overlay"><div class="search-box">
      <input id="search-input" type="text" placeholder="Search chapters…" autocomplete="off">
      <div class="search-results" id="search-results"></div>
      <div class="search-foot"><span><span class="kbd">↑↓</span> navigate</span><span><span class="kbd">↵</span> open</span><span><span class="kbd">esc</span> close</span></div>
    </div></div><div id="toast"></div>`);

  const idx = [];
  COURSES.forEach(c => c.chapters.forEach(ch => idx.push({...ch, key:c.key, hex:c.hex,
    hay:(ch.title+" "+ch.desc+" "+ch.tags.join(" ")+" "+ch.sim).toLowerCase()})));
  let sel=0, hits=[];
  const ov=$("search-overlay"), inp=$("search-input"), res=$("search-results");
  const open =()=>{ ov.classList.add("open"); inp.value=""; render(""); inp.focus(); };
  const close=()=> ov.classList.remove("open");
  function render(q){
    q=q.trim().toLowerCase();
    hits = q ? idx.filter(x=>q.split(/\s+/).every(w=>x.hay.includes(w))).slice(0,12) : idx.slice(0,8);
    sel=0;
    res.innerHTML = hits.length ? hits.map((h,i)=>`<div class="sr-item ${i?"":"sel"}" data-i="${i}">
      <span class="sr-course" style="color:${h.hex};background:${h.hex}18">${h.key.toUpperCase()}</span>
      <div style="min-width:0"><div class="sr-title">${h.title}</div><div class="sr-desc">${h.desc}</div></div></div>`).join("")
      : `<div class="sr-empty">No chapters match “${q}”.</div>`;
    res.querySelectorAll(".sr-item").forEach(x=>{
      x.onclick=()=>pick(+x.dataset.i);
      x.onmousemove=()=>{ sel=+x.dataset.i; paint(); };
    });
  }
  const paint=()=>res.querySelectorAll(".sr-item").forEach(x=>x.classList.toggle("sel",+x.dataset.i===sel));
  const pick=i=>{ const h=hits[i]; if(h) location.href = BUILT.has(h.id) ? h.id+".html" : COURSE_PAGE[h.key]; };
  $("searchbtn").onclick=open; inp.oninput=()=>render(inp.value);
  ov.onclick=e=>{ if(e.target===ov) close(); };
  document.addEventListener("keydown", e=>{
    const isOpen = ov.classList.contains("open");
    if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="k"){ e.preventDefault(); isOpen?close():open(); return; }
    if(isOpen){
      if(e.key==="Escape") close();
      else if(e.key==="ArrowDown"){ e.preventDefault(); sel=Math.min(sel+1,hits.length-1); paint(); }
      else if(e.key==="ArrowUp"){ e.preventDefault(); sel=Math.max(sel-1,0); paint(); }
      else if(e.key==="Enter") pick(sel);
      return;
    }
    if(e.target.tagName==="INPUT"||e.target.tagName==="TEXTAREA") return;
    if(e.key==="/"){ e.preventDefault(); open(); }
  });
}
let tt; function toast(h){ const t=$("toast"); t.innerHTML=h; t.classList.add("show");
  clearTimeout(tt); tt=setTimeout(()=>t.classList.remove("show"),3600); }

/* ---------- landing ---------- */
function renderLanding(){
  chrome(null);
  $("cards").innerHTML = COURSES.map(c=>{
    const built = c.chapters.filter(ch=>BUILT.has(ch.id)).length;
    const done  = c.chapters.filter(ch=>progress[ch.id]).length;
    const tag = built ? `href="${COURSE_PAGE[c.key]}"` : "";
    return `<a class="ccard${built?"":" soon"}" ${tag} style="--ca:${c.hex}">
      <div class="cc-badge">${c.tagline}</div><h3>${c.name}</h3>
      <p>${c.desc.split(".").slice(0,2).join(".")}.</p>
      <div class="cc-bar"><div class="cc-fill" style="width:${done/c.chapters.length*100}%"></div></div>
      <div class="cc-meta"><span>${built} / ${c.chapters.length} chapters built</span>
        <span style="color:${c.hex}">${done} completed</span>
        ${LABS[c.key]?`<span style="color:${c.hex}">+ lab</span>`:""}</div>
      <div class="cc-go">→</div></a>`;
  }).join("");
  const labs = Object.entries(LABS);
  $("labs").innerHTML = labs.length ? labs.map(([k,l])=>{
    const hex = (COURSES.find(c=>c.key===k)||{}).hex || "#60a5fa";
    return `<a class="labcard" href="${l.file}" style="--ca:${hex}">
      <div class="li">⚡</div><div><div class="lt">${l.title}</div><div class="ld">${l.desc}</div></div></a>`;
  }).join("") : `<div style="color:var(--dim);font-size:13.5px">No labs published yet.</div>`;
  heroCanvas();
}

/* ---------- course page ---------- */
function renderCourse(key){
  chrome(key);
  const c = COURSES.find(x=>x.key===key);
  document.documentElement.style.setProperty("--ca", c.hex);
  const N = c.chapters.length;
  $("chero").innerHTML = `<div class="cb">${c.tagline}</div><h1>${c.name}</h1>
    <p class="sub">${c.desc}</p>
    <div class="cstats">
      <div class="cstat"><div class="n">${N}</div><div class="l">Chapters</div></div>
      <div class="cstat"><div class="n" id="c-done">0</div><div class="l">Completed</div></div>
      <div class="cstat"><div class="n" id="c-pct">0%</div><div class="l">Progress</div></div>
    </div>`;
  const lab = LABS[key];
  $("labslot").innerHTML = lab ? `<div class="sec-h">Hands-on</div><div class="sec-b">Run it yourself</div>
    <p class="sec-p">The chapters explain mechanism. The lab makes you prove it on your own machine.</p>
    <a class="labcard" href="${lab.file}" style="--ca:${c.hex}">
      <div class="li">⚡</div><div><div class="lt">${lab.title}</div><div class="ld">${lab.desc}</div></div></a>` : "";
  $("flow").innerHTML = FLOW_STEPS.map((s,i)=>
    `<div class="flow-step"><div class="flow-chip"><span class="n">${String(i+1).padStart(2,"0")}</span>${s}</div>`+
    (i<FLOW_STEPS.length-1?`<span class="flow-arrow">→</span>`:"")+`</div>`).join("");
  $("chcount").textContent = N + " chapters, in order";

  const grid = $("grid");
  c.chapters.forEach((ch,i)=>{
    const a = document.createElement("article");
    a.className = "chapter reveal" + (progress[ch.id]?" done":"") + (BUILT.has(ch.id)?" available":"");
    a.style.setProperty("--accent", c.hex);
    a.title = "Simulator: " + ch.sim;
    a.innerHTML = `<div class="ch-top"><span class="ch-num">CH ${String(i+1).padStart(2,"0")}</span>
        <div class="checkbox">${CHECK}</div></div>
      <div class="ch-title">${ch.title}</div><div class="ch-desc">${ch.desc}</div>
      <div class="ch-tags">${ch.tags.map(t=>`<span class="tag">${t}</span>`).join("")}</div>
      <div class="ch-foot"><span class="ch-status"><span class="sdot"></span>${BUILT.has(ch.id)?"OPEN LESSON":"NOT YET BUILT"}</span>
        <span class="tag sim">⚡ ${ch.sim.split("—")[0].trim()}</span></div>`;
    a.querySelector(".checkbox").onclick = e=>{
      e.stopPropagation();
      if(progress[ch.id]) delete progress[ch.id]; else progress[ch.id]=true;
      a.classList.toggle("done", !!progress[ch.id]); saveProgress(); tally();
    };
    a.onclick = ()=> BUILT.has(ch.id) ? location.href = ch.id+".html"
                                      : toast(`<b>${ch.title}</b> hasn't been generated yet.`);
    grid.appendChild(a);
  });
  function tally(){
    const d = c.chapters.filter(x=>progress[x.id]).length;
    $("c-done").textContent = d;
    $("c-pct").textContent = Math.round(d/N*100)+"%";
  }
  tally();
}

/* ---------- hero canvas (landing only) ---------- */
function heroCanvas(){
  const c=$("hero-canvas"); if(!c) return;
  const x=c.getContext("2d"), COL=["#60a5fa","#f25c54","#ff9f43","#4ade80","#a78bfa"];
  let W,H,nodes=[],edges=[],pk=[],last=0;
  function rs(){ const d=Math.min(devicePixelRatio||1,2); W=c.clientWidth;H=c.clientHeight;
    c.width=W*d;c.height=H*d;x.setTransform(d,0,0,d,0,0); build(); }
  function build(){ nodes=[];edges=[];pk=[];
    for(let i=0,n=Math.max(12,Math.floor(W/95));i<n;i++)
      nodes.push({x:Math.random()*W,y:Math.random()*H,vx:(Math.random()-.5)*.18,vy:(Math.random()-.5)*.18,
                  r:1.6+Math.random()*2.2,c:COL[i%COL.length]});
    nodes.forEach((a,i)=>nodes.map((b,j)=>({j,d:(a.x-b.x)**2+(a.y-b.y)**2})).filter(o=>o.j!==i)
      .sort((p,q)=>p.d-q.d).slice(0,2).forEach(o=>{
        if(!edges.some(e=>(e.a===i&&e.b===o.j)||(e.a===o.j&&e.b===i))) edges.push({a:i,b:o.j}); })); }
  function fr(ts){ const dt=Math.min(ts-last,50); last=ts; x.clearRect(0,0,W,H);
    nodes.forEach(n=>{ n.x+=n.vx*dt*.06; n.y+=n.vy*dt*.06;
      if(n.x<0||n.x>W)n.vx*=-1; if(n.y<0||n.y>H)n.vy*=-1; });
    x.lineWidth=1; x.strokeStyle="rgba(96,120,170,.10)";
    edges.forEach(e=>{ const a=nodes[e.a],b=nodes[e.b];
      x.beginPath();x.moveTo(a.x,a.y);x.lineTo(b.x,b.y);x.stroke(); });
    if(Math.random()<.09&&pk.length<24&&edges.length){ const e=edges[Math.floor(Math.random()*edges.length)],f=Math.random()<.5;
      pk.push({a:f?e.b:e.a,b:f?e.a:e.b,t:0,s:.004+Math.random()*.008,c:nodes[e.a].c}); }
    pk=pk.filter(q=>q.t<=1);
    pk.forEach(q=>{ q.t+=q.s*dt*.06; const a=nodes[q.a],b=nodes[q.b],t=Math.min(1,q.t);
      x.beginPath(); x.fillStyle=q.c; x.shadowColor=q.c; x.shadowBlur=8;
      x.arc(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t,1.8,0,7); x.fill(); x.shadowBlur=0; });
    nodes.forEach(n=>{ x.beginPath();x.fillStyle=n.c+"cc";x.arc(n.x,n.y,n.r,0,7);x.fill();
      x.beginPath();x.fillStyle=n.c+"18";x.arc(n.x,n.y,n.r*3.2,0,7);x.fill(); });
    const g=x.createRadialGradient(W/2,H/2,H*.12,W/2,H/2,H*.8);
    g.addColorStop(0,"rgba(7,9,13,.84)"); g.addColorStop(1,"rgba(7,9,13,0)");
    x.fillStyle=g; x.fillRect(0,0,W,H); requestAnimationFrame(fr); }
  addEventListener("resize",rs); rs(); requestAnimationFrame(fr);
}
""")

# ---------------------------------------------------------------- shells
def shell(title, body, boot):
    return f"""<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>{title}</title>
<link rel="stylesheet" href="assets/site.css">
</head><body>
{body}
<script src="data/site.js"></script>
<script src="assets/site.js"></script>
<script>{boot}</script>
</body></html>
"""

landing_body = """<header class="landing">
  <canvas id="hero-canvas" style="position:absolute;inset:0;width:100%;height:100%"></canvas>
  <div style="position:relative;z-index:2;max-width:860px">
    <div class="hero-eyebrow"><span class="dot"></span>INTERACTIVE SYSTEMS COURSES · STAFF+ DEPTH</div>
    <h1>Open the black boxes.<br><span class="grad">All the way down.</span></h1>
    <p class="hero-sub">Deep dives into the <b>internal implementation</b> of the systems you already use —
      animated simulators, source-code walkthroughs, byte-level layouts, failure injection.
      Not <i>how to use them</i>. <b>How they are built</b>.</p>
  </div>
</header>
<main class="page">
  <div class="sec-h">Courses</div><div class="sec-b">Pick a system</div>
  <div class="coursecards" id="cards"></div>
  <div class="sec-h">Hands-on labs</div><div class="sec-b">Stop reading, start running</div>
  <p class="sec-p">The courses explain mechanism. The labs make you prove it on your own machine — a Docker
    cluster, experiments that surface each internal, a config cookbook with reasoning, operational runbooks,
    and build projects.</p>
  <div id="labs"></div>
</main>"""

course_body = """<main class="page">
  <div class="chero" id="chero"></div>
  <div id="labslot"></div>
  <div class="sec-h">Method</div><div class="sec-b">Every chapter follows the same 15-step arc</div>
  <p class="sec-p">No concept is presented as a fact. Each is derived: the problem, the naive solution, why it
    collapses under concurrency or failure, and the refinements that led to what ships — ending in a simulator
    you can break.</p>
  <div class="flow" id="flow"></div>
  <div class="sec-h">Chapters</div><div class="sec-b" id="chcount"></div>
  <div class="chapters" id="grid"></div>
</main>"""

open("index.html","w",encoding="utf-8").write(
    shell("SYS/INTERNALS — Interactive Systems Courses", landing_body, "renderLanding();"))

for key, fn, title in [("pg","course-postgresql.html","PostgreSQL Internals — Interactive Course"),
                       ("kafka","course-kafka.html","Apache Kafka Internals — Interactive Course"),
                       ("wa","course-whatsapp.html","WhatsApp Architecture — Interactive Course")]:
    open(fn,"w",encoding="utf-8").write(shell(title, course_body, f'renderCourse("{key}");'))

for f in ["index.html","course-postgresql.html","course-kafka.html","course-whatsapp.html",
          "assets/site.css","assets/site.js","data/site.js"]:
    print(f"{f:28s} {os.path.getsize(f)//1024:4d} KB")
