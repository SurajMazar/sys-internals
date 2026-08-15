
/* Shared renderer for the landing page and every course page.
   Reads everything from data/site.js — no content lives here. */
"use strict";
const $ = id => document.getElementById(id);
const LS_KEY = "sysinternals-progress-v1";
let progress = {}; try { progress = JSON.parse(localStorage.getItem(LS_KEY)) || {}; } catch(e){}
const saveProgress = () => localStorage.setItem(LS_KEY, JSON.stringify(progress));
const CHECK = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#07090d" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';

/* Display order: alphabetical by short name. COURSES in data/site.js stays in
   whatever order is convenient to edit; this is the single place order is decided. */
const ORDERED = [...COURSES].sort((a, b) =>
  (a.short || a.name).localeCompare(b.short || b.name, undefined, { sensitivity: "base" }));

/* ---------- chrome: topnav + search overlay, injected once ---------- */
function chrome(activeKey){
  document.body.insertAdjacentHTML("afterbegin",
    `<div class="topnav"><a class="brand" href="index.html">SYS/<span>INTERNALS</span></a>` +
    ORDERED.filter(c => c.enabled !== false && COURSE_PAGE[c.key])
           .map(c=>`<a class="tl${c.key===activeKey?" on":""}" href="${COURSE_PAGE[c.key]}">${c.short || c.name}</a>`).join("") +
    `<span class="sp"></span><div class="searchbtn" id="searchbtn">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
      Search <span class="kbd">/</span></div>
      <button id="theme-toggle" title="Toggle light / dark" aria-label="Toggle light and dark theme">☀️</button></div>`);

  (function themeInit(){
    const KEY = "sysinternals-theme", btn = $("theme-toggle");
    const sync = () => { btn.textContent = document.documentElement.getAttribute("data-theme") === "light" ? "🌙" : "☀️"; };
    sync();
    btn.onclick = () => {
      const light = document.documentElement.getAttribute("data-theme") === "light";
      if (light) { document.documentElement.removeAttribute("data-theme"); localStorage.setItem(KEY, "dark"); }
      else { document.documentElement.setAttribute("data-theme", "light"); localStorage.setItem(KEY, "light"); }
      sync();
    };
  })();
  document.body.insertAdjacentHTML("beforeend",
    `<div id="search-overlay"><div class="search-box">
      <input id="search-input" type="text" placeholder="Search chapters…" autocomplete="off">
      <div class="search-results" id="search-results"></div>
      <div class="search-foot"><span><span class="kbd">↑↓</span> navigate</span><span><span class="kbd">↵</span> open</span><span><span class="kbd">esc</span> close</span></div>
    </div></div><div id="toast"></div>`);

  const idx = [];
  ORDERED.forEach(c => c.chapters.forEach(ch => idx.push({...ch, key:c.key, hex:c.hex,
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
  $("cards").innerHTML = ORDERED.map(c=>{
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
  const labs = ORDERED.filter(c => LABS[c.key]).map(c => [c.key, LABS[c.key]]);
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
