
"use strict";
/* ============================================================
   0. GENERIC MACHINERY
   ============================================================ */
function el(id){ return document.getElementById(id); }

function stepper(rootId, steps){
  const root = el(rootId);
  const stage = root.querySelector(".deck-stage");
  const cap = root.querySelector(".deck-cap");
  const dots = root.querySelector(".deck-dots");
  const prev = root.querySelector(".prev"), next = root.querySelector(".next");
  let i = -1;
  steps.forEach((s,k)=>{ const d=document.createElement("button"); d.className="dot";
    d.onclick=()=>go(k); dots.appendChild(d); });
  function go(k){
    k = Math.max(0, Math.min(steps.length-1, k));
    if (k === i) return;
    i = k;
    stage.classList.remove("in");
    setTimeout(()=>{
      stage.innerHTML = steps[i].stage;
      cap.innerHTML = `<span class="deck-stepnum">STEP ${i+1} / ${steps.length}</span>` + steps[i].cap;
      stage.classList.add("in");
      [...dots.children].forEach((d,j)=>d.classList.toggle("on", j<=i));
      prev.disabled = i===0; next.disabled = i===steps.length-1;
      if (steps[i].onshow) steps[i].onshow(stage);
    }, 120);
  }
  prev.onclick = ()=>go(i-1);
  next.onclick = ()=>go(i+1);
  go(0);
}

function qaCards(rootId, items){
  const root = el(rootId);
  items.forEach(it=>{
    const d = document.createElement("div");
    d.className = "qa";
    d.innerHTML = `<div class="qa-q"><span class="lvl">${it.lvl}</span>${it.q}</div>
      ${it.hint?`<div class="qa-hint">hint: ${it.hint}</div>`:""}
      <button class="btn qa-btn">Reveal answer</button><div class="qa-a">${it.a}</div>`;
    d.querySelector(".qa-btn").onclick = e=>{ d.classList.add("open"); e.target.style.display="none"; };
    d.querySelector(".qa-q").onclick = ()=>{ if(!d.classList.contains("open")){ d.classList.add("open"); d.querySelector(".qa-btn").style.display="none"; } };
    root.appendChild(d);
  });
}

/* ============================================================
   0b. REAL SHA-256 (FIPS 180-4) — shared by the shachain widget
       and the simulator's HTLC hash-locks. Genuine computation,
       no fake-looking hex.
   ============================================================ */
const SHA256 = (function(){
  const K = new Uint32Array([
    0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
    0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
    0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
    0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
    0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
    0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
    0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
    0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2
  ]);
  const H_INIT = new Uint32Array([0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19]);
  function rotr(x,n){ return ((x>>>n)|(x<<(32-n)))>>>0; }
  function hex8(w){ return (w>>>0).toString(16).padStart(8,"0"); }
  function toBytes(strOrBytes){
    if (strOrBytes instanceof Uint8Array) return strOrBytes;
    return new TextEncoder().encode(String(strOrBytes));
  }
  function pad(bytes){
    const bitLenHi = Math.floor(bytes.length / 0x20000000) >>> 0;
    const bitLenLo = (bytes.length * 8) >>> 0;
    let total = bytes.length + 1;
    while (total % 64 !== 56) total++;
    total += 8;
    const out = new Uint8Array(total);
    out.set(bytes, 0);
    out[bytes.length] = 0x80;
    const dv = new DataView(out.buffer);
    dv.setUint32(total-8, bitLenHi, false);
    dv.setUint32(total-4, bitLenLo, false);
    return out;
  }
  function blockToWords(padded, blockIdx){
    const off = blockIdx*64;
    const dv = new DataView(padded.buffer, padded.byteOffset+off, 64);
    const w = new Uint32Array(16);
    for (let i=0;i<16;i++) w[i] = dv.getUint32(i*4, false);
    return w;
  }
  function expand(w16){
    const W = new Uint32Array(64);
    W.set(w16, 0);
    for (let t=16;t<64;t++){
      const s0 = rotr(W[t-15],7) ^ rotr(W[t-15],18) ^ (W[t-15]>>>3);
      const s1 = rotr(W[t-2],17) ^ rotr(W[t-2],19) ^ (W[t-2]>>>10);
      W[t] = (W[t-16] + s0 + W[t-7] + s1) >>> 0;
    }
    return W;
  }
  function compress(H, W){
    let a=H[0],b=H[1],c=H[2],d=H[3],e=H[4],f=H[5],g=H[6],h=H[7];
    for (let t=0;t<64;t++){
      const S1 = rotr(e,6) ^ rotr(e,11) ^ rotr(e,25);
      const ch = (e & f) ^ (~e & g);
      const T1 = (h + S1 + ch + K[t] + W[t]) >>> 0;
      const S0 = rotr(a,2) ^ rotr(a,13) ^ rotr(a,22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const T2 = (S0 + maj) >>> 0;
      h=g; g=f; f=e; e=(d + T1) >>> 0;
      d=c; c=b; b=a; a=(T1 + T2) >>> 0;
    }
    return new Uint32Array([
      (H[0]+a)>>>0, (H[1]+b)>>>0, (H[2]+c)>>>0, (H[3]+d)>>>0,
      (H[4]+e)>>>0, (H[5]+f)>>>0, (H[6]+g)>>>0, (H[7]+h)>>>0
    ]);
  }
  function digestHex(input){
    const padded = pad(toBytes(input));
    let H = H_INIT.slice();
    for (let bi=0; bi*64<padded.length; bi++) H = compress(H, expand(blockToWords(padded, bi)));
    return Array.from(H).map(hex8).join("");
  }
  function u32ToBytes(H){
    const out = new Uint8Array(32); const dv = new DataView(out.buffer);
    for (let i=0;i<8;i++) dv.setUint32(i*4, H[i], false);
    return out;
  }
  function digestBytes(bytes){
    const padded = pad(bytes);
    let H = H_INIT.slice();
    for (let bi=0; bi*64<padded.length; bi++) H = compress(H, expand(blockToWords(padded, bi)));
    return u32ToBytes(H);
  }
  function bytesToHex(bytes){ return Array.from(bytes).map(b=>b.toString(16).padStart(2,"0")).join(""); }
  function randomBytes(n){ const b = new Uint8Array(n); crypto.getRandomValues(b); return b; }
  return { toBytes, digestHex, digestBytes, bytesToHex, randomBytes };
})();
(function selfTest(){
  const got = SHA256.digestHex("abc");
  const want = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";
  if (got === want) console.log("%cSHA-256 self-test passed:", "color:#4ade80", got);
  else console.error("SHA-256 self-test FAILED", got, "expected", want);
})();

/* ============================================================
   0c. shachain generate_from_seed — REAL BOLT #3 Appendix D
       algorithm, parameterized over bit-width so the pedagogical
       10-bit slider (§8) and the simulator's full 48-bit channel
       (§15) share one implementation.
   ============================================================ */
function generateFromSeed(seedBytes, index, bits, trace){
  let P = seedBytes.slice();
  const steps = trace ? [] : null;
  for (let b = bits-1; b >= 0; b--){
    if ((index & (1 << b)) !== 0){
      const byteIdx = 31 - Math.floor(b/8);
      const bitIdx = b % 8;
      const before = SHA256.bytesToHex(P);
      P[byteIdx] ^= (1 << bitIdx);
      const flipped = SHA256.bytesToHex(P);
      P = SHA256.digestBytes(P);
      if (trace) steps.push({ bit:b, before, flipped, after: SHA256.bytesToHex(P) });
    }
  }
  return { result: P, steps };
}

/* ============================================================
   1. TIMELINE (§2)
   ============================================================ */
const TL = [
  { yr:"2013", l:"nSequence hack", d:"<b>Satoshi's original sketch, revived by Mike Hearn.</b> A refund transaction whose nSequence field is meant to let later, more-generous versions replace earlier ones in miners' mempools before confirmation. Genuinely a payment channel — one-directional, hard-expiring, and dependent on a mempool convention no consensus rule enforces. §3–4 of this chapter derive exactly why it wasn't enough." },
  { yr:"2015 (Feb)", l:"Poon–Dryja draft", d:"<b>“The Bitcoin Lightning Network: Scalable Off-chain Instant Payments.”</b> Joseph Poon and Thaddeus Dryja circulate the paper that names the network and introduces the two ideas that survive to production: revocable commitment transactions (penalty-based, not replacement-based) and hash-locked multi-hop routing. The malleability problem (chapter 5) is already flagged as a blocker to building real software against it." },
  { yr:"2015", l:"Duplex channels", d:"<b>Decker & Wattenhofer, independently, publish duplex micropayment channels</b> using an invalidation-tree construction rather than per-state penalties — a different mechanism reaching a similar goal, and a reminder that the penalty/revocation design this chapter teaches was a choice among live alternatives, not the only workable one." },
  { yr:"2016", l:"BOLT specs begin", d:"<b>The lightning-rfc repository opens.</b> Multiple teams — building what become LND, Core Lightning (then c-lightning), and Eclair — agree to converge on one interoperable wire protocol, the BOLTs (Basis Of Lightning Technology), rather than ship incompatible private networks. This is why a channel between two different implementations works at all." },
  { yr:"2017 (Aug)", l:"SegWit activates", d:"<b>BIP141 locks in.</b> Chapter 12's fix for transaction malleability removes the two-year blocker: commitment transactions can now safely reference a not-yet-confirmed funding output's witness-restructured txid without it changing underneath them. Lightning's first mainnet channels open within months." },
  { yr:"2018", l:"Mainnet, and the fee-spike lesson", d:"<b>Early mainnet adoption</b> coincides with a period of extreme on-chain fee volatility. Some channels' fixed-at-signing commitment fees prove too low to confirm a force-close promptly — the direct cause of the anchor-outputs redesign covered in §11." },
  { yr:"2019 (Jan)", l:"The Lightning Torch", d:"<b>A single payment, passed hand to hand</b> across hundreds of participants worldwide over routed HTLCs, growing slightly each hop — a publicity stunt, but a real one: every hop was a genuine multi-hop hash-locked payment across independently operated nodes, demonstrating the routing layer worked at real, if modest, scale." },
  { yr:"2020", l:"Anchor outputs", d:"<b>BOLT #3 updated</b> to add small, always-spendable anchor outputs to every commitment transaction, decoupling the fee locked in at signing time from the fee actually needed to confirm during a dispute — the direct fix for the 2018 lesson, detailed in §11." },
  { yr:"2020", l:"Flood & Loot published", d:"<b>Harris & Zohar's academic disclosure</b> shows mempool congestion can be weaponized against HTLC timeout deadlines — an early, precise formal statement of the pinning family of attacks chapter 11 covers generally." },
  { yr:"2021 (Nov)", l:"Taproot activates", d:"<b>BIP340–342 lock in.</b> Schnorr signatures and MuSig2 key aggregation (chapter 13) open the door to PTLCs — point-time-locked contracts that could eventually replace hash-locked HTLCs and close the cross-hop correlation leak §8 describes. As of this writing, PTLC support remains experimental." },
  { yr:"2022–23", l:"Replacement cycling disclosed", d:"<b>Antoine Riard's disclosure</b> shows RBF's replacement rules can be exploited to repeatedly evict a victim's time-sensitive claim transaction from the mempool — directly informing the bitcoin-dev mailing list's full-RBF and mempool-pinning debates. Detailed in §11." },
  { yr:"ongoing", l:"eltoo, splicing, jamming", d:"<b>Unfinished business.</b> BIP118 (SIGHASH_ANYPREVOUT / “eltoo”) proposes replacing penalty-based revocation with a simpler always-latest-state design — not yet activated on mainnet. Splicing (resizing a channel without closing it) has shipped in major implementations. Channel jamming remains an open, unsolved griefing vector. This chapter teaches the deployed design, not a finished one." }
];
const tlTrack = el("tl-track"), tlDetail = el("tl-detail");
TL.forEach((t,i)=>{
  const item = document.createElement("div");
  item.className = "tl-item" + (i===4 ? " on" : "");
  item.innerHTML = `<div class="tl-dot"></div><div class="tl-yr">${t.yr}</div><div class="tl-l">${t.l}</div>`;
  item.onclick = ()=>{ [...tlTrack.children].forEach(c=>c.classList.remove("on")); item.classList.add("on"); tlDetail.innerHTML = t.d; };
  tlTrack.appendChild(item);
});
tlDetail.innerHTML = TL[4].d;

/* ============================================================
   2. DECK: symmetric commitments and the cheat (§5)
   ============================================================ */
(function(){
  const bars = (a,b,note)=>`<div class="cbars"><div class="cbar-row"><span class="cb-name">ALICE</span>
    <div class="cbar-track"><div class="cbar-fill local" style="width:${a*100}%">${a.toFixed(2)}</div></div></div>
    <div class="cbar-row"><span class="cb-name">BOB</span>
    <div class="cbar-track"><div class="cbar-fill remote" style="width:${b*100}%">${b.toFixed(2)}</div></div></div></div>
    ${note?`<p style="text-align:center;color:var(--dim);font-family:var(--mono);font-size:11px;margin-top:10px">${note}</p>`:""}`;
  const steps = [
    { stage: bars(0.5,0.5,"C0 — funding confirms, both sign the initial split"),
      cap: "<b>Funding confirms.</b> Alice and Bob co-sign commitment C0: 0.5/0.5. Both hold an identical, fully valid copy. Either could broadcast it right now and it would settle exactly this split — which is fine, because it's still the true current state." },
    { stage: bars(0.4,0.6,"C1 — Alice pays Bob 0.1; both sign; C0 is 'discarded'"),
      cap: "<b>First payment.</b> Alice sends Bob 10,000,000 sats worth off-chain. Both sign C1: 0.4/0.6. They agree, by convention only, that C0 is void. Nothing on-chain reflects that agreement — C0 is still a perfectly valid, fully-signed transaction sitting on both parties' disks." },
    { stage: bars(0.1,0.9,"C2 — many payments later: 0.1/0.9"),
      cap: "<b>Months of payments later.</b> The channel now sits at 0.1/0.9. C0 (0.5/0.5) and C1 (0.4/0.6) are both still, individually, valid signed transactions spending the same funding output. Every one of them remains broadcastable forever — signatures don't expire." },
    { stage: bars(0.5,0.5,"⚠ Alice broadcasts C0 — chain sees a valid 0.5/0.5 split") + `<p style="text-align:center;color:var(--bad);font-family:var(--mono);font-size:12px;margin-top:6px">the chain cannot tell C0 apart from a legitimate current state</p>`,
      cap: "<b>The exploit.</b> Alice broadcasts C0. Bitcoin's consensus rules check exactly one thing: are both multisig signatures valid for this input? Yes — they were valid the day it was signed and remain valid forever. The transaction confirms. Alice just recovered 0.5 BTC she has no remaining economic claim to, and Bob's only recourse is whatever the two of them agreed to off-chain, which is nothing a court or a script can enforce." }
  ];
  stepper("deckSymmetric", steps);
})();

/* ============================================================
   3. DECK: 3-hop HTLC payment (§8c)
   ============================================================ */
(function(){
  const hop = (name,state,sub)=>`<div class="hopnode ${state}">${name}<span class="hn-t">${sub}</span></div>`;
  const row = (...parts)=>`<div class="hoprow">${parts.join('<span class="hoparrow">→</span>')}</div>`;
  const steps = [
    { stage: `<p style="text-align:center;margin-bottom:14px">Carol wants to be paid. She has channels with no one Alice can reach directly except through Bob.</p>` + row(hop("ALICE","", "sender"), hop("BOB","","forwarder"), hop("CAROL","","recipient")),
      cap: "<b>Setup.</b> Alice → Bob → Carol, one channel per edge, no channel Alice–Carol. Carol generates a random 32-byte preimage <code>R</code> and publishes only <code>H = SHA256(R)</code> in a BOLT11 invoice. Nobody but Carol knows R yet." },
    { stage: row(hop("ALICE","locked","H, timeout=T+144"), hop("BOB","","waiting"), hop("CAROL","","waiting")),
      cap: "<b>Hop 1: Alice offers Bob an HTLC.</b> An output on Alice–Bob's updated commitment pays Bob if he reveals a preimage of H within 144 blocks, else it reverts to Alice. Bob has not forwarded anything yet — he has only received a conditional promise." },
    { stage: row(hop("ALICE","locked","H, timeout=T+144"), hop("BOB","locked","H, timeout=T+100"), hop("CAROL","","waiting")),
      cap: "<b>Hop 2: Bob offers Carol the same hash, a shorter timeout.</b> 100 blocks, not 144 — the cltv_expiry_delta Bob subtracts before forwarding, so he always has a safety margin to claim from Alice after Carol claims from him." },
    { stage: row(hop("ALICE","locked","H, timeout=T+144"), hop("BOB","locked","H, timeout=T+100"), hop("CAROL","settled","reveals R")),
      cap: "<b>Carol reveals R.</b> She already knows it — she generated it. Revealing it to claim Bob's HTLC costs her nothing extra; it's the same action as accepting payment." },
    { stage: row(hop("ALICE","locked","H, timeout=T+144"), hop("BOB","settled","claims with R"), hop("CAROL","settled","paid")),
      cap: "<b>Bob uses the same R to claim from Alice.</b> He watched Carol's commitment update, extracted R, and immediately uses it against Alice's HTLC — well inside his 44-block margin. Bob never needed to be trusted with anything except correct forwarding: he could not have claimed from Alice without first paying Carol, because he had no other way to learn R." },
    { stage: row(hop("ALICE","settled","paid out"), hop("BOB","settled","fee earned"), hop("CAROL","settled","received")),
      cap: "<b>Final state.</b> Alice's commitment with Bob now reflects the payment plus Bob's routing fee; Bob's commitment with Carol reflects the payment minus his fee. No transaction hit the chain. If Bob had gone offline before claiming from Alice, he'd simply lose his forwarding fee at worst — Alice's HTLC would time out at T+144 and revert to her, since Bob never revealed anything to claim it." }
  ];
  stepper("deckHtlc", steps);
})();
/* ============================================================
   4. SHACHAIN SLIDER (§8b) — real generate_from_seed, live
   ============================================================ */
(function(){
  const DEMO_BITS = 10;
  const seed = SHA256.randomBytes(32);
  const idxEl = el("sc-idx"), valEl = el("sc-idx-val"), lblEl = el("sc-idx-lbl");
  const bitsEl = el("sc-bits"), traceEl = el("sc-trace"), resultEl = el("sc-result");
  function render(){
    const I = +idxEl.value;
    valEl.textContent = I; lblEl.textContent = I;
    bitsEl.innerHTML = "";
    for (let b = DEMO_BITS-1; b>=0; b--){
      const set = (I & (1<<b)) !== 0;
      const c = document.createElement("div");
      c.className = "bitcell" + (set ? " set" : "");
      c.textContent = "B"+b;
      bitsEl.appendChild(c);
    }
    const { result, steps } = generateFromSeed(seed, I, DEMO_BITS, true);
    if (steps.length === 0){
      traceEl.textContent = "I = 0 — no bits set, no iterations. per_commitment_secret(0) is the seed itself.";
    } else {
      traceEl.textContent = steps.map((s,k)=>
        `iter ${k+1}: bit ${s.bit} set → flip byte, P: ${s.before.slice(0,16)}… → ${s.flipped.slice(0,16)}…\n` +
        `         P = SHA256(P) → ${s.after.slice(0,16)}…`
      ).join("\n");
    }
    resultEl.textContent = SHA256.bytesToHex(result);
  }
  idxEl.addEventListener("input", render);
  render();
})();

/* ============================================================
   5. ONION PACKET SLIDER (§8d)
   ============================================================ */
(function(){
  const VERSION = 1, PUBKEY = 33, PAYLOAD = 1300, HMAC = 32;
  const PER_HOP = 65; // representative legacy per-hop payload+HMAC bytes
  const hopsEl = el("onion-hops"), valEl = el("onion-hops-val");
  const legendEl = el("onion-legend"), mapEl = el("onion-map"), noteEl = el("onion-note");
  const COLORS = { v:"#60a5fa", k:"#a78bfa", real:"#f7931a", pad:"#2a3446", h:"#4ade80" };
  function render(){
    const hops = +hopsEl.value;
    valEl.textContent = hops;
    const realBytes = Math.min(PAYLOAD, hops * PER_HOP);
    const padBytes = PAYLOAD - realBytes;
    const total = VERSION + PUBKEY + PAYLOAD + HMAC;
    const seg = (w,color,label)=>`<div class="seg" style="width:${(w/total*100).toFixed(2)}%;background:${color}">${label}</div>`;
    mapEl.innerHTML = seg(VERSION, COLORS.v, "V") + seg(PUBKEY, COLORS.k, "pubkey 33B")
      + seg(realBytes, COLORS.real, realBytes>60?`real hop data ${realBytes}B`:"")
      + seg(padBytes, COLORS.pad, padBytes>60?`padding ${padBytes}B`:"")
      + seg(HMAC, COLORS.h, "HMAC");
    legendEl.innerHTML = `<span><span class="sw" style="background:${COLORS.v}"></span>version (1B)</span>
      <span><span class="sw" style="background:${COLORS.k}"></span>ephemeral pubkey (33B)</span>
      <span><span class="sw" style="background:${COLORS.real}"></span>real per-hop data (~${PER_HOP}B × ${hops} hops)</span>
      <span><span class="sw" style="background:${COLORS.pad}"></span>random padding, indistinguishable from real data</span>
      <span><span class="sw" style="background:${COLORS.h}"></span>HMAC (32B)</span>`;
    noteEl.textContent = hops >= Math.floor(PAYLOAD/PER_HOP)
      ? `At ${hops} hops the real payload nearly fills the fixed 1,300-byte field — this is close to the practical maximum route length the legacy format supports before there's no room left for padding.`
      : `Total packet size stays exactly ${total} bytes regardless of hop count. An observer intercepting this packet at any single hop cannot distinguish "${padBytes} bytes of padding because the route is short" from "${padBytes} bytes of someone else's still-encrypted hop data because the route is long."`;
  }
  hopsEl.addEventListener("input", render);
  render();
})();

/* ============================================================
   6. ARCHITECTURE EXPLORER (§7)
   ============================================================ */
const ARCH = {
  funding: { name:"Funding transaction", file:"BOLT #3 §2 · on-chain, once per channel", body:"A single 2-of-2 P2WSH output committing both parties' capital. This is the only transaction guaranteed to hit the chain at open — everything else is designed to avoid needing a second on-chain transaction until close." },
  commit: { name:"Commitment transaction (asymmetric)", file:"BOLT #3 §3", body:"Each party holds a different, individually valid transaction spending the funding output: the holder's own balance is paid via a CSV-delayed to_local output (with a revocation escape hatch); the counterparty's balance is paid immediately via to_remote. §8(a) derives the exact script." },
  htlc: { name:"HTLC output scripts", file:"BOLT #3 §5", body:"Extra outputs on a commitment transaction representing in-flight multi-hop payments — each with a hash-lock success path and a CLTV timeout path, plus the same revocation escape hatch as to_local. §8(c) derives them from the atomicity requirement." },
  revstore: { name:"Revocation secret store (shachain)", file:"BOLT #3 Appendix D", body:"Rather than storing every per-commitment secret ever received, a party stores at most 47 secrets and regenerates any earlier one on demand via generate_from_seed's bit-flip procedure — the live derivation in §8(b)." },
  gossip: { name:"Channel graph (gossip)", file:"BOLT #7", body:"channel_announcement proves a channel exists (signed by both nodes' identity keys and the funding transaction's own keys — proof of on-chain capital, not just claim); channel_update advertises fee policy and CLTV delta per direction. Balances are deliberately never gossiped — §10 covers why that's the dominant real-world failure mode." },
  onion: { name:"Sphinx onion construction", file:"BOLT #4", body:"Alice layers per-hop encrypted instructions using ephemeral Diffie-Hellman shared secrets, padded to a fixed 1,300-byte payload regardless of route length. §8(d) builds the exact byte layout." },
  invoice: { name:"BOLT11 invoice / BOLT12 offer", file:"BOLT #11 / #12", body:"The payment hash H (and increasingly, reusable BOLT12 offers) that the recipient hands the sender out-of-band — QR code, URL, NFC tap. This is the one piece of the protocol that isn't gossiped or routed; it has to reach the sender through some other channel entirely." },
  watchtower: { name:"Watchtower", file:"third-party service, various specs", body:"A node you delegate to, giving it encrypted 'justice transaction' blueprints for each state as it's revoked, without revealing channel contents unless a breach actually occurs. Exists specifically to remove the 'must be online constantly' cost §6 identified — at the cost of trusting a third party to actually watch." },
  forceclose: { name:"Force-close path", file:"BOLT #5", body:"Either party can unilaterally broadcast their current commitment transaction at any time, without the counterparty's cooperation. Correct, but expensive: one on-chain transaction for the commitment plus one per in-flight HTLC, and the to_self_delay before the broadcaster's own funds are spendable." },
  mempool: { name:"Mempool / fee bumping", file:"chapter 11 + BOLT #3 anchor outputs", body:"A force-close's transactions must actually confirm before their respective timeouts. Anchor outputs (§11) let either party attach a fee-bumping child transaction after the fact, decoupling 'the fee we agreed on when we signed' from 'the fee needed to win the current mempool.'" }
};
(function(){
  const detail = el("arch-detail");
  function show(key){
    const a = ARCH[key];
    detail.innerHTML = `<div class="ad-name">${a.name}</div><div class="ad-file">${a.file}</div><p>${a.body}</p>`;
    document.querySelectorAll(".acard").forEach(c=>c.classList.toggle("sel", c.dataset.p===key));
  }
  document.querySelectorAll(".acard").forEach(c=>c.onclick = ()=>show(c.dataset.p));
  show("funding");
})();

/* ============================================================
   7. PERFORMANCE CHART (§10)
   ============================================================ */
(function(){
  const chansEl = el("perf-chans"), chansVal = el("perf-chans-val");
  const txdayEl = el("perf-txday"), txdayVal = el("perf-txday-val");
  const canvas = el("perf-chart"), ctx = canvas.getContext("2d");
  const ONCHAIN_CEILING = 7; // tx/s, chapter 7/12 derivation
  function draw(){
    const chans = +chansEl.value, txday = +txdayEl.value;
    chansVal.textContent = chans + " M";
    txdayVal.textContent = txday;
    const offchainRate = (chans * 1e6 * txday) / 86400; // payments/sec network-wide
    const W = canvas.width, H = canvas.height, pad = 36;
    ctx.clearRect(0,0,W,H);
    const maxY = Math.max(offchainRate * 1.15, ONCHAIN_CEILING * 4);
    const yOf = v => H-pad - (v/maxY)*(H-pad*2);
    // axes
    ctx.strokeStyle = "#1c2330"; ctx.lineWidth = 1;
    for (let g=0; g<=4; g++){
      const y = pad + g*(H-pad*2)/4;
      ctx.beginPath(); ctx.moveTo(pad,y); ctx.lineTo(W-10,y); ctx.stroke();
    }
    // on-chain ceiling — flat dashed line
    ctx.strokeStyle = "#f25c54"; ctx.lineWidth = 2; ctx.setLineDash([6,5]);
    ctx.beginPath(); ctx.moveTo(pad, yOf(ONCHAIN_CEILING)); ctx.lineTo(W-10, yOf(ONCHAIN_CEILING)); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#f25c54"; ctx.font = "10px monospace";
    ctx.fillText("~7 tx/s ceiling (chapters 7 & 12)", pad+4, yOf(ONCHAIN_CEILING)-6);
    // off-chain bar growing left to right as a curve vs channel count (illustrative sweep)
    ctx.strokeStyle = "#f7931a"; ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let x=0; x<=100; x++){
      const c = (x/100) * chans;
      const rate = (c * 1e6 * txday) / 86400;
      const px = pad + (x/100)*(W-pad-10);
      const py = yOf(rate);
      if (x===0) ctx.moveTo(px,py); else ctx.lineTo(px,py);
    }
    ctx.stroke();
    // marker at current setting
    ctx.fillStyle = "#f7931a";
    ctx.beginPath(); ctx.arc(W-10, yOf(offchainRate), 4, 0, 7); ctx.fill();
    ctx.fillStyle = "#8b94a7"; ctx.font = "10px monospace";
    ctx.fillText("payments/sec, network-wide →", pad, 14);
    el("perf-note").innerHTML = `At <b style="color:var(--pg)">${chans.toLocaleString()} M</b> active channels averaging <b style="color:var(--pg)">${txday}</b> payments/day each, the off-chain network is settling roughly <b style="color:var(--pg)">${offchainRate.toLocaleString(undefined,{maximumFractionDigits:0})}</b> payments/sec — while the base layer underneath it is still doing the same ~7 tx/s it always could. None of those payments needed a block; only the channels' opens and closes did.`;
  }
  chansEl.addEventListener("input", draw);
  txdayEl.addEventListener("input", draw);
  draw();
})();

/* ============================================================
   8. INTERVIEW CARDS (§12)
   ============================================================ */
qaCards("qa-interview", [
  { lvl:"SENIOR", q:"Why does only the BROADCASTER'S OWN output get delayed in a commitment transaction, and not both outputs?", hint:"who needs the reaction window, and against whom?",
    a:"The delay exists to give the non-broadcasting counterparty time to detect a revoked state and claim a penalty. If Alice broadcasts, it's her own to_local output that needs to be delayed — Bob's to_remote output is already just paying Bob, so delaying it would only slow down an honest settlement without protecting anyone. Delaying both outputs would double the wait for zero additional security; delaying neither removes the reaction window entirely. The asymmetry is the minimum change that achieves the goal." },
  { lvl:"SENIOR", q:"A channel has been open for a year with 50,000 updates. Roughly how much storage does a well-implemented node need for revocation secrets, and why?", hint:"shachain, not a flat array",
    a:"At most 47 stored 32-byte secrets (under 1.5 KB), regardless of update count, because of BOLT #3's shachain structure: any earlier secret can be regenerated from a later, structurally 'higher' stored secret via generate_from_seed's deterministic bit-flip procedure. A naive implementation storing every secret individually would need 50,000 × 32 bytes ≈ 1.6 MB for this one channel alone — the shachain trick is what makes storing revocation state for thousands of long-lived channels practical." },
  { lvl:"SENIOR", q:"Why must the CLTV timeout strictly decrease at every hop moving toward the payment destination?", hint:"who has to act after whom, and how long does that take?",
    a:"A forwarding node can only safely claim the incoming HTLC from its predecessor after it has already claimed the outgoing HTLC from its successor (or observed the successor's timeout). If the outgoing timeout equaled the incoming one, a forwarder could reveal the preimage to its successor right at the deadline, leaving no safety margin to turn around and claim from its predecessor before that leg also expires — the forwarder pays the successor and then loses the reimbursement. Each hop subtracts a margin (cltv_expiry_delta) specifically to guarantee it never lands in that gap." },
  { lvl:"STAFF", q:"An intermediate hop is offline when a payment is supposed to route through it. What actually happens, and who bears the cost?", hint:"there is no global retry authority",
    a:"The upstream node attempting to open the HTLC with the offline peer fails immediately (no channel update can occur with a peer you can't reach), and it returns an encrypted onion error back toward the sender. The sender's node decrypts it (only it can, since it built the onion) and retries with an alternate route, if one exists. The offline node bears no direct cost beyond lost routing fees for that attempt; the sender bears the latency cost of a failed hop plus the CPU/bandwidth of building a new onion. No funds are ever at risk in this failure mode specifically because the HTLC to the unreachable node was never actually offered." },
  { lvl:"STAFF", q:"Why doesn't the network gossip each channel's live balance, and what specific engineering problem would it cause if it did?", hint:"gossip is flooded to every node, and balances change on every payment",
    a:"Two reasons compound. First, privacy: live balances would let anyone reconstruct approximate payment flows across the network, defeating a large part of the reason to use channels instead of transparent on-chain transfers. Second, and just as important operationally: gossip messages are flooded to every node on the network, and balances change on literally every payment — advertising them would mean every payment anywhere generates network-wide gossip traffic proportional to total payment volume, an entirely different (and far worse) scaling problem than the one Lightning exists to solve. The tradeoff accepted instead is the routing-failure UX cost covered in §10." },
  { lvl:"STAFF", q:"Explain the replacement cycling attack in terms the mempool-pinning material from chapter 11 would predict, without looking it up.", hint:"RBF lets you replace YOUR OWN transaction — what if that's the attack surface, not someone else's?",
    a:"Chapter 11 establishes that a transaction's confirmation timing can be manipulated by controlling what occupies the same input or fee-relevant mempool slot. Replacement cycling generalizes this: an attacker doesn't need to pin a victim's transaction directly — they can create their own transaction that conflicts with an input the victim's justice or HTLC-claim transaction needs, then repeatedly replace their own transaction with a new version of itself. Each replacement evicts the victim's pending transaction (which conflicts with the attacker's) from mempools without the attacker's transaction ever confirming, at low cost to the attacker (they just need to pay slightly more each cycle than their own prior version). Given enough cycles, the victim's HTLC timeout passes before their claim confirms." },
  { lvl:"PRINCIPAL", q:"Design review: a colleague proposes removing revocation entirely and instead relying on 'whoever broadcasts first wins, and it's always the latest state because we'll just not sign old commitments after a new one exists.' What breaks?", hint:"signatures already exist the moment they're created — you cannot un-sign",
    a:"The proposal confuses a protocol convention with a cryptographic guarantee. Once a commitment transaction is fully signed by both parties, it is valid forever — 'we agree not to use it' is a promise, not a constraint the chain enforces, exactly the failure §5–6 derived. 'First broadcast wins' doesn't help either: nothing stops the disadvantaged party from broadcasting an old, more favorable-to-them state the moment the relationship sours, and being first is entirely within their control since they're the one initiating the cheat. The only ways to actually close this hole are: (a) penalize old-state broadcasts economically (the deployed answer — revocation), or (b) redesign the transaction so that only the LATEST state is ever validly broadcastable in the first place, which is what eltoo (BIP118, SIGHASH_ANYPREVOUT) proposes by letting a new commitment explicitly spend and thereby invalidate the prior one on-chain — not yet deployed, and a legitimately different tradeoff (no penalty needed, but requires a new sighash flag most of the network hasn't activated)." }
]);
/* ============================================================
   9. QUIZ (§14)
   ============================================================ */
const QUIZ = [
  { q:"In a commitment transaction, why does the to_local output need BOTH a CSV delay and a revocation escape hatch, rather than just one or the other?",
    opts:[ "The delay alone gives a reaction window, but only the revocation branch lets the counterparty actually claim funds within it if the state was revoked — a delay with no way to act on it protects nobody",
           "It's pure redundancy in case one opcode has a bug",
           "The delay is for miners' benefit and the revocation branch is for wallets' benefit",
           "Only Taproot channels need both; legacy channels need neither" ],
    a:0,
    why:"A delay with nothing to do during it accomplishes nothing — it needs to be paired with a condition (the counterparty proving they hold the revocation key for this exact commitment) that lets the honest party actually intervene during that window. Option B ignores that both mechanisms are load-bearing and serve different roles (timing vs. authorization); C misattributes the beneficiaries — miners don't care about either; D is false, every commitment format from the original design onward uses both." },
  { q:"Alice and Bob's channel has updated 200 times. Alice broadcasts commitment #50 (long since superseded). What, precisely, makes this detectable and punishable?",
    opts:[ "Bitcoin Core rejects old commitment transactions by consensus rule",
           "Bob (or his watchtower) recognizes commitment #50, derives its revocation key from the per-commitment secret he was given when it was superseded, and claims the entire balance before Alice's delay expires",
           "The transaction is invalid because too much time has passed since it was signed",
           "Miners refuse to confirm a transaction referencing an old commitment number" ],
    a:1,
    why:"Nothing about the transaction itself is invalid — it's a fully signed, correctly formed spend of the funding output, and Bitcoin's consensus rules have no concept of 'commitment number 50 is stale.' The security is entirely off-chain: Bob must recognize the state, must have retained (or be able to derive via shachain) the specific per-commitment secret for #50, and must act within the to_self_delay window. Options A, C, and D each invent a consensus-level check that does not exist — which is exactly why liveness (§6, §11's watchtower discussion) matters so much." },
  { q:"Why must a forwarding node's outgoing CLTV timeout to the next hop be SHORTER than the incoming timeout it received?",
    opts:[ "Shorter timeouts are cheaper in transaction fees",
           "It gives the forwarder a safety margin to claim its incoming HTLC after the outgoing one resolves, before its own deadline arrives",
           "BOLT #4 requires it for privacy, unrelated to safety",
           "It doesn't need to be shorter — this is a common misconception" ],
    a:1,
    why:"The forwarder can only safely claim from its predecessor after resolving with its successor. If the margin were zero or negative, a slow block or brief delay could let the forwarder's incoming HTLC expire and revert before it finishes claiming from its successor — the forwarder pays out and gets nothing back. The margin (cltv_expiry_delta) exists purely for this sequencing safety, not fees (A) or privacy (C); and D is simply wrong — it is a hard requirement, not a misconception." },
  { q:"The Sphinx onion payload is fixed at 1,300 bytes no matter how many hops are in the route. What would break if a shorter route simply sent a shorter packet instead?",
    opts:[ "Nothing would break; it would just save bandwidth",
           "Every intermediate hop could infer approximately how many hops remain (or preceded it) from the packet's size, weakening the anonymity set the fixed size is designed to protect",
           "The HMAC integrity check requires exactly 1,300 bytes to compute",
           "SHA-256 only operates correctly on inputs of that exact length" ],
    a:1,
    why:"A variable-length packet leaks route-length information to every hop that touches it, letting nodes narrow down where they sit on a payment's path and correlate payments more easily — precisely the metadata the fixed-size, padding-filled format is built to hide. C and D are both technically false: HMAC and SHA-256 operate over arbitrary-length input; there's no size dependency in the primitives themselves, only in this specific protocol's chosen design." },
  { q:"Why doesn't BOLT #7 gossip include each channel's live, directional balance?",
    opts:[ "It's a planned feature not yet implemented",
           "Balances change on every payment, so gossiping them would flood the network proportional to payment volume, and it would also destroy most of the privacy channels are meant to provide",
           "Balances are gossiped, just encrypted so only the two channel peers can decrypt them",
           "Nodes are technically incapable of measuring their own channel balance" ],
    a:1,
    why:"This is a deliberate design choice, not a missing feature (ruling out A) or a technical limitation (ruling out D). Balances are not gossiped at all, encrypted or otherwise (ruling out C) — only total capacity and fee/CLTV policy are announced, and both stay reasonably static, unlike balance which moves on every single payment. The direct consequence is §10's routing-failure problem: you cannot know if a route has enough directional liquidity without attempting the payment." },
  { q:"During a period of high on-chain fee volatility, a channel's force-close transaction, signed weeks earlier at a much lower feerate, is at risk of never confirming before an HTLC timeout. Which real, deployed mechanism addresses exactly this?",
    opts:[ "Increasing the channel's to_self_delay",
           "Anchor outputs, which let either party attach a child transaction and use Child-Pays-For-Parent to bump the effective feerate at broadcast time",
           "Renegotiating the commitment transaction's signature after the fact",
           "Switching the channel to a higher-fee-tier commitment format automatically" ],
    a:1,
    why:"Anchor outputs (§11) were added to BOLT #3 specifically because pre-signed commitment fees, fixed at signing time, could become stale by the time a dispute forces a broadcast — exactly this scenario, which surfaced during real 2017–2018 fee spikes. A is unrelated (to_self_delay affects when funds are spendable, not confirmation priority); C is impossible without both parties' cooperation, which a dispute by definition lacks; D describes no mechanism that exists in the protocol." }
];
(function(){
  const root = el("quiz");
  let answered = 0, correct = 0;
  QUIZ.forEach((item,qi)=>{
    const d = document.createElement("div");
    d.className = "q";
    d.innerHTML = `<span class="q-num">QUESTION ${qi+1} / ${QUIZ.length}</span><div class="q-text">${item.q}</div>` +
      item.opts.map((o,i)=>`<div class="opt" data-i="${i}"><span class="ol">${"ABCD"[i]}</span><span>${o}</span></div>`).join("") +
      `<div class="expl"></div>`;
    const expl = d.querySelector(".expl");
    d.querySelectorAll(".opt").forEach(opt=>{
      opt.onclick = ()=>{
        if (d.dataset.done) return;
        d.dataset.done = 1; answered++;
        const pick = +opt.dataset.i;
        if (pick === item.a) correct++;
        d.querySelectorAll(".opt").forEach(o=>{
          o.classList.add("disabled");
          if (+o.dataset.i === item.a) o.classList.add("correct");
          else if (+o.dataset.i === pick) o.classList.add("wrong");
        });
        expl.innerHTML = `<b style="color:var(--pg)">${pick===item.a ? "Correct." : "Not quite — "+"ABCD"[item.a]+" is right."}</b> ${item.why}`;
        expl.classList.add("show");
        el("quiz-progress").textContent = `${answered} / ${QUIZ.length}`;
        if (answered === QUIZ.length)
          el("quiz-score").innerHTML = `Score: <b>${correct} / ${QUIZ.length}</b> — ${correct===6?"flawless; you could review lightning-dev PRs.":correct>=4?"solid mental model; skim the explanations you missed.":"re-run §8's decks and the §15 simulator — the mechanics click fast once you cheat your own channel."}`;
      };
    });
    root.appendChild(d);
  });
})();

/* order quiz */
(function(){
  const CORRECT = [
    "Carol generates preimage R, publishes invoice with H = SHA256(R)",
    "Alice computes a candidate route from her locally cached channel graph (gossip)",
    "Alice builds a layered Sphinx onion, one encrypted layer per hop, padded to 1,300 bytes",
    "Alice offers Bob an HTLC on their commitment: locked to H, timeout T1",
    "Bob offers Carol an HTLC on their commitment: locked to H, timeout T2 < T1",
    "Carol reveals R, claiming Bob's HTLC and updating their commitment",
    "Bob extracts R and claims Alice's HTLC before T1, updating their commitment",
    "Alice's channel with Bob reflects the final balance — no on-chain transaction occurred"
  ];
  const root = el("order-quiz");
  let picks = [];
  const shuffled = CORRECT.map((t,i)=>({t,i})).sort(()=>Math.random()-.5);
  function render(){
    root.innerHTML = "";
    shuffled.forEach(item=>{
      const idx = picks.indexOf(item.i);
      const d = document.createElement("div");
      d.className = "order-item" + (idx>=0 ? " picked" : "");
      d.innerHTML = `<span class="seq">${idx>=0 ? idx+1 : ""}</span><span>${item.t}</span>`;
      d.onclick = ()=>{
        const at = picks.indexOf(item.i);
        if (at >= 0) picks.splice(at,1); else picks.push(item.i);
        render();
      };
      root.appendChild(d);
    });
  }
  el("order-check").onclick = ()=>{
    if (picks.length !== CORRECT.length){ el("order-verdict").textContent = `pick all ${CORRECT.length} first (${picks.length} chosen)`; return; }
    let ok = 0;
    [...root.children].forEach((d,di)=>{
      const item = shuffled[di], pos = picks.indexOf(item.i);
      d.classList.remove("right","wrong2");
      if (pos === item.i){ d.classList.add("right"); ok++; } else d.classList.add("wrong2");
    });
    el("order-verdict").innerHTML = ok===CORRECT.length ? `<span style="color:var(--ok)">perfect — that's the real payment lifecycle</span>` : `<span style="color:var(--warn)">${ok}/${CORRECT.length} in position — green ones are correctly placed</span>`;
  };
  el("order-reset").onclick = ()=>{ picks=[]; el("order-verdict").textContent=""; render(); };
  render();
})();

/* knowledge check (§16) */
qaCards("qa-check", [
  { lvl:"THINK", q:"Chapter 15 covers the block-size war — the multi-year governance fight over whether to raise Bitcoin's block size instead of building Layer 2. Using this chapter's ~7 tx/s derivation, predict: would doubling or 10×-ing the block size have made Lightning unnecessary?",
    a:"No — it would have delayed, not removed, the ceiling. Doubling block size roughly doubles throughput to ~14 tx/s, still orders of magnitude below global payment volume, while raising the hardware and bandwidth bar to run a validating node (chapter 12's trilemma). Even a 10× increase leaves you short of real payment-network throughput while meaningfully centralizing validation toward well-resourced operators. Lightning's O(1)-on-chain-footprint-per-relationship property scales with the number of channels and payments per channel, not with block size, which is why it addresses the actual asymptotic problem rather than moving the same ceiling slightly higher — the core argument that ultimately won the block-size debate." },
  { lvl:"THINK", q:"Chapter 15 covers CVE-2018-17144, a bug that let a specially crafted block crash or double-spend against a vulnerable node. Predict: if an attacker could reliably crash a target's node right as one of their channel's HTLCs approached its timeout, how does that interact with everything you just learned about watchtowers and force-closes?",
    a:"It's a liveness attack on exactly the assumption §6 and §11 identified as the residual cost of the whole design: someone must be watching the chain to react within a timeout window. A crashed node cannot broadcast a timely HTLC-claim or justice transaction, cannot detect a counterparty's revoked-state broadcast, and cannot bump a stuck force-close's fee. This is precisely why watchtowers exist as a third party that keeps watching even if your own node is down — and precisely why a node-crashing bug timed against channel timeouts is a genuinely dangerous class of vulnerability for a Lightning-heavy node operator, not just an availability nuisance." },
  { lvl:"THINK", q:"Chapter 15 covers the 2015 SPV-mining incident, where a chain briefly forked because some miners were extending headers without validating the blocks underneath. Predict what this implies for how many confirmations a Lightning node should wait before treating a channel's on-chain funding or closing transaction as truly final.",
    a:"A channel opened or closed against a funding/closing transaction with only 1 confirmation is exposed to exactly the kind of shallow reorg the 2015 SPV-mining fork demonstrated: blocks that briefly extend the chain without full validation, discovered invalid, and reorged away. If that transaction disappears, a channel might be considered open (or closed) when it isn't — implementations universally require multiple confirmations (commonly 3–6) before treating channel state changes as settled, trading a few extra minutes of latency at open/close for protection against exactly this class of shallow-reorg incident. It's a direct, practical instance of chapter 8's probabilistic-finality math applied to a specific piece of software." }
]);

/* ============================================================
   10. SIMULATOR (§15)
   ============================================================ */
(function(){
  const logEl = el("sim-log");
  function log(lv, msg){
    const d = document.createElement("div");
    d.className = "lv-"+lv;
    d.textContent = (lv==="OK"||lv==="HINT" ? "" : lv+":  ") + msg;
    logEl.appendChild(d);
    while (logEl.children.length > 140) logEl.removeChild(logEl.firstChild);
    logEl.scrollTop = logEl.scrollHeight;
  }

  /* ---------- TAB SWITCHING ---------- */
  el("tab-chan").onclick = ()=>{
    el("pane-chan").style.display = ""; el("pane-route").style.display = "none";
    el("tab-chan").classList.add("on"); el("tab-route").classList.remove("on");
    el("sim-phase").textContent = "CHANNEL";
  };
  el("tab-route").onclick = ()=>{
    el("pane-route").style.display = ""; el("pane-chan").style.display = "none";
    el("tab-route").classList.add("on"); el("tab-chan").classList.remove("on");
    el("sim-phase").textContent = "ROUTING";
    renderNetGraph();
  };

  /* ---------- CHANNEL & REVOCATION ---------- */
  const CHAN = { seed: SHA256.randomBytes(32), states:[{i:0,a:0.5,b:0.5}], secrets:{}, selected:0, penalties:0 };

  function renderChan(){
    const total = CHAN.states.length;
    const last = CHAN.states[total-1];
    el("bar-alice").style.width = Math.max(0,last.a*100)+"%"; el("bar-alice").textContent = last.a.toFixed(2);
    el("bar-bob").style.width = Math.max(0,last.b*100)+"%"; el("bar-bob").textContent = last.b.toFixed(2);
    el("chan-history").innerHTML = CHAN.states.map(s=>{
      const isLatest = s.i === total-1;
      const known = CHAN.secrets[s.i] !== undefined;
      const cls = "cnode" + (CHAN.selected===s.i?" hot":"") + (!isLatest && !s.penalty ? " revoked":"") + (s.penalty?" cheat":"");
      const tag = s.penalty ? " — PENALTY STATE" : isLatest ? " (current)" : known ? " (revoked — secret known)" : "";
      return `<div class="${cls}" data-i="${s.i}">#${s.i} — Alice ${s.a.toFixed(2)} / Bob ${s.b.toFixed(2)}${tag}</div>`;
    }).join("");
    document.querySelectorAll("#chan-history .cnode").forEach(n=>{
      n.onclick = ()=>{ CHAN.selected = +n.dataset.i; renderChan(); };
    });
    const sel = CHAN.states.find(s=>s.i===CHAN.selected);
    el("chan-insp").innerHTML = sel ? `<div class="i-t">SELECTED STATE</div><div>commitment #${sel.i} — Alice ${sel.a.toFixed(2)} / Bob ${sel.b.toFixed(2)}<br>
      <span style="color:var(--dim)">${sel.i===total-1 ? "current — safe to broadcast" : (CHAN.secrets[sel.i] ? "REVOKED — counterparty can derive the penalty key" : "no secret recorded")}</span></div>`
      : `<div class="i-t">SELECTED STATE</div><div style="color:var(--dim)">click a commitment above…</div>`;
    el("cnt-states").textContent = total;
    el("cnt-secrets").textContent = Object.keys(CHAN.secrets).length;
    el("cnt-penalties").textContent = CHAN.penalties;
  }

  function pay(direction, amt){
    const last = CHAN.states[CHAN.states.length-1];
    let newA = last.a, newB = last.b;
    if (direction==="toBob"){ newA -= amt; newB += amt; } else { newA += amt; newB -= amt; }
    if (newA < -1e-9 || newB < -1e-9){ log("WARN","insufficient balance for that update"); return; }
    newA = Math.max(0,+newA.toFixed(8)); newB = Math.max(0,+newB.toFixed(8));
    const newIndex = CHAN.states.length;
    const prevIndex = newIndex - 1;
    CHAN.states.push({ i:newIndex, a:newA, b:newB });
    const secret = generateFromSeed(CHAN.seed, prevIndex, 48).result;
    CHAN.secrets[prevIndex] = SHA256.bytesToHex(secret);
    log("LOG", `both parties sign commitment #${newIndex}: Alice ${newA.toFixed(2)} / Bob ${newB.toFixed(2)}`);
    log("WARN", `commitment #${prevIndex} revoked — per_commitment_secret(${prevIndex}) = ${CHAN.secrets[prevIndex].slice(0,16)}… exchanged via generate_from_seed`);
    renderChan();
  }
  el("c-pay-bob").onclick = ()=>pay("toBob", 0.10);
  el("c-pay-alice").onclick = ()=>pay("toAlice", 0.10);

  el("c-close-latest").onclick = ()=>{
    const last = CHAN.states[CHAN.states.length-1];
    log("OK", `cooperative close: commitment #${last.i} broadcast by mutual agreement — Alice ${last.a.toFixed(2)} / Bob ${last.b.toFixed(2)} settle immediately (no to_self_delay needed when both parties co-sign a closing transaction).`);
  };
  el("c-broadcast-selected").onclick = ()=>{
    const s = CHAN.states.find(x=>x.i===CHAN.selected);
    if (!s){ log("WARN","select a commitment first"); return; }
    const latestIndex = CHAN.states.length - 1;
    if (s.i === latestIndex){
      log("OK", `Alice broadcasts commitment #${s.i} — this IS the current state. After to_self_delay confirms, Alice's ${s.a.toFixed(2)} BTC output becomes spendable. No penalty condition exists because nothing was revoked.`);
      return;
    }
    log("FATAL", `Alice broadcasts commitment #${s.i} — a REVOKED state, attempting to reclaim Alice ${s.a.toFixed(2)} / Bob ${s.b.toFixed(2)} instead of the current balance.`);
    const known = CHAN.secrets[s.i];
    const recomputed = SHA256.bytesToHex(generateFromSeed(CHAN.seed, s.i, 48).result);
    if (known && known === recomputed){
      log("WARN", `Bob's node (or his watchtower) recognizes commitment #${s.i}, recomputes per_commitment_secret(${s.i}) via generate_from_seed, and confirms it matches the secret exchanged when this state was superseded.`);
      log("PANIC", `PENALTY TRANSACTION broadcast: revocation key = f(revocation_basepoint, per_commitment_secret(${s.i})). Entire channel balance (1.00000000 BTC) claimed by Bob before Alice's to_self_delay expires.`);
      CHAN.penalties++;
      CHAN.selected = CHAN.states.length;
      CHAN.states.push({ i:CHAN.selected, a:0, b:1.0, penalty:true });
    } else {
      log("LOG", "no matching revocation secret on file — this would only happen for the very first, never-superseded state.");
    }
    renderChan();
  };
  renderChan();

  /* ---------- ROUTING & HTLCs ---------- */
  const POS = { Alice:[8,50], Bob:[36,15], Carol:[68,50], Dave:[36,85], Erin:[68,88] };
  const BASE_EDGES = [
    { a:"Alice", b:"Bob",   capAB:5, capBA:5, fee:200, cltv:40 },
    { a:"Alice", b:"Dave",  capAB:3, capBA:3, fee:400, cltv:40 },
    { a:"Bob",   b:"Carol", capAB:8, capBA:2, fee:150, cltv:40 },
    { a:"Bob",   b:"Dave",  capAB:4, capBA:4, fee:100, cltv:34 },
    { a:"Dave",  b:"Erin",  capAB:6, capBA:6, fee:120, cltv:40 },
    { a:"Dave",  b:"Carol", capAB:2, capBA:2, fee:300, cltv:40 },
    { a:"Carol", b:"Erin",  capAB:5, capBA:5, fee:250, cltv:40 }
  ];
  let EDGES = BASE_EDGES.map(e=>({...e}));
  let LAST_ROUTE = null;

  Object.keys(POS).filter(n=>n!=="Alice").forEach(n=>{
    const o = document.createElement("option"); o.value = n; o.textContent = n; el("r-dest").appendChild(o);
  });

  function arcsFor(){
    const arcs = [];
    EDGES.forEach(e=>{
      arcs.push({from:e.a, to:e.b, cap:e.capAB, fee:e.fee, cltv:e.cltv, edge:e, fwd:true});
      arcs.push({from:e.b, to:e.a, cap:e.capBA, fee:e.fee, cltv:e.cltv, edge:e, fwd:false});
    });
    return arcs;
  }

  function dijkstra(src, dst, amount){
    const arcs = arcsFor().filter(a=>a.cap >= amount - 1e-9);
    const nodes = Object.keys(POS);
    const dist = {}, prev = {}, visited = new Set();
    nodes.forEach(n=>dist[n]=Infinity); dist[src]=0;
    while (true){
      let u = null, best = Infinity;
      nodes.forEach(n=>{ if (!visited.has(n) && dist[n] < best){ best = dist[n]; u = n; } });
      if (u === null) break;
      visited.add(u);
      if (u === dst) break;
      arcs.filter(a=>a.from===u).forEach(a=>{
        const alt = dist[u] + a.fee;
        if (alt < dist[a.to]){ dist[a.to] = alt; prev[a.to] = { node:u, arc:a }; }
      });
    }
    if (dist[dst] === Infinity) return null;
    const path = [dst]; const usedArcs = [];
    let cur = dst;
    while (cur !== src){ const p = prev[cur]; usedArcs.unshift(p.arc); path.unshift(p.node); cur = p.node; }
    return { path, arcs: usedArcs, totalFee: dist[dst] };
  }

  function renderNetGraph(){
    const g = el("netgraph");
    if (!g) return;
    g.innerHTML = "";
    const rect = g.getBoundingClientRect();
    const W = rect.width || 600, H = rect.height || 230;
    const dest = el("r-dest").value;
    const pathNodes = new Set(LAST_ROUTE ? LAST_ROUTE.path : []);
    const pathArcKeys = new Set(LAST_ROUTE ? LAST_ROUTE.arcs.map(a=>a.from+"|"+a.to) : []);
    function pt(name){ const p = POS[name]; return [p[0]/100*W, p[1]/100*H]; }
    EDGES.forEach(e=>{
      const [x1,y1] = pt(e.a), [x2,y2] = pt(e.b);
      const dx=x2-x1, dy=y2-y1, len=Math.sqrt(dx*dx+dy*dy), ang=Math.atan2(dy,dx)*180/Math.PI;
      const onPath = pathArcKeys.has(e.a+"|"+e.b) || pathArcKeys.has(e.b+"|"+e.a);
      const lowCap = Math.min(e.capAB, e.capBA) < 0.02;
      const line = document.createElement("div");
      line.className = "netedge" + (onPath?" onpath":"") + (lowCap?" failed":"");
      line.style.left = x1+"px"; line.style.top = y1+"px"; line.style.width = len+"px";
      line.style.transform = `rotate(${ang}deg)`;
      g.appendChild(line);
      const lbl = document.createElement("div");
      lbl.style.cssText = `position:absolute;left:${(x1+x2)/2}px;top:${(y1+y2)/2}px;transform:translate(-50%,-50%);font-family:var(--mono);font-size:9px;color:${onPath?"var(--pg)":"var(--dim)"};background:var(--bg-2);padding:1px 4px;border-radius:4px;white-space:nowrap`;
      lbl.textContent = `${e.fee}/${e.cltv}/${e.capAB.toFixed(2)}↔${e.capBA.toFixed(2)}`;
      g.appendChild(lbl);
    });
    Object.keys(POS).forEach(name=>{
      const [x,y] = pt(name);
      const n = document.createElement("div");
      n.className = "netnode" + (name==="Alice"?" src":"") + (pathNodes.has(name)?" path":"") + (name===dest?" dst":"");
      n.style.left = x+"px"; n.style.top = y+"px";
      n.textContent = name;
      g.appendChild(n);
    });
  }
  el("r-dest").onchange = renderNetGraph;

  el("r-amt").addEventListener("input", ()=>{ el("r-amt-val").textContent = (+el("r-amt").value/100).toFixed(2); });

  el("r-find").onclick = ()=>{
    const dest = el("r-dest").value;
    const amount = +el("r-amt").value/100;
    const route = dijkstra("Alice", dest, amount);
    if (!route){
      LAST_ROUTE = null;
      log("FATAL", `no route to ${dest} with ≥ ${amount.toFixed(2)} BTC directional liquidity on every hop.`);
      el("route-insp").innerHTML = `<div class="i-t">ROUTE</div><div style="color:var(--bad)">no route found — some channel along every candidate path lacks liquidity in the needed direction.</div>`;
    } else {
      LAST_ROUTE = route;
      const totalCltv = route.arcs.reduce((s,a)=>s+a.cltv, 18);
      log("OK", `route found: ${route.path.join(" → ")} — total fee ${route.totalFee} (fee-weighted units), total worst-case CLTV ${totalCltv} blocks.`);
      el("route-insp").innerHTML = `<div class="i-t">ROUTE</div><div>${route.path.join(" → ")}<br>
        <span style="color:var(--dim)">fee ${route.totalFee} · cltv ${totalCltv} blocks · ${route.arcs.length} hop(s)</span></div>`;
    }
    renderNetGraph();
  };

  el("r-send").onclick = ()=>{
    if (!LAST_ROUTE){ log("WARN","find a route first"); return; }
    const dest = el("r-dest").value;
    const amount = +el("r-amt").value/100;
    const R = SHA256.randomBytes(32);
    const H = SHA256.bytesToHex(SHA256.digestBytes(R));
    log("LOG", `${dest} generates preimage R, publishes invoice H = SHA256(R) = ${H.slice(0,16)}…`);
    let cltv = 18;
    const perHop = LAST_ROUTE.arcs.slice().reverse();
    const timeouts = [];
    perHop.forEach(a=>{ timeouts.unshift(cltv); cltv += a.cltv; });
    LAST_ROUTE.arcs.forEach((a,i)=>{
      log("LOG", `${a.from} offers ${a.to} an HTLC: ${amount.toFixed(2)} BTC locked to H, timeout=+${timeouts[i]} blocks`);
    });
    const Rhex = SHA256.bytesToHex(R);
    const check = SHA256.bytesToHex(SHA256.digestBytes(R));
    const verified = check === H;
    log(verified ? "OK" : "FATAL", `${dest} reveals R = ${Rhex.slice(0,16)}… — SHA256(R) ${verified?"MATCHES":"does NOT match"} H, claim ${verified?"accepted":"rejected"}.`);
    if (verified){
      for (let i = LAST_ROUTE.arcs.length-1; i>=0; i--){
        const a = LAST_ROUTE.arcs[i];
        log("OK", `${a.from} extracts R from ${a.to}'s commitment update, claims its own HTLC from the previous hop.`);
        const e = a.edge;
        if (a.fwd){ e.capAB = +(e.capAB - amount).toFixed(8); e.capBA = +(e.capBA + amount).toFixed(8); }
        else { e.capBA = +(e.capBA - amount).toFixed(8); e.capAB = +(e.capAB + amount).toFixed(8); }
      }
      log("OK", `payment settled: ${amount.toFixed(2)} BTC delivered to ${dest} across ${LAST_ROUTE.arcs.length} hop(s). Zero on-chain transactions.`);
    }
    LAST_ROUTE = null;
    el("route-insp").innerHTML = `<div class="i-t">ROUTE</div><div style="color:var(--dim)">find a route…</div>`;
    renderNetGraph();
  };

  el("r-drain").onclick = ()=>{
    const e = EDGES[Math.floor(Math.random()*EDGES.length)];
    if (Math.random() < 0.5) e.capAB = 0.001; else e.capBA = 0.001;
    log("WARN", `channel ${e.a}↔${e.b} drained in one direction — that channel can no longer forward meaningful amounts that way, and nobody outside the two peers was told.`);
    LAST_ROUTE = null;
    renderNetGraph();
  };
  el("r-reset").onclick = ()=>{
    EDGES = BASE_EDGES.map(e=>({...e}));
    LAST_ROUTE = null;
    log("LOG", "network reset to initial capacities.");
    el("route-insp").innerHTML = `<div class="i-t">ROUTE</div><div style="color:var(--dim)">find a route…</div>`;
    renderNetGraph();
  };

  log("OK", "channel lab ready.");
  log("HINT", "Tab 1: pay Bob a few times, then broadcast an early state. Tab 2: drain a channel, then re-route.");
})();

/* ============================================================
   11. CHROME: readbar, scrollspy, keys, completion
   ============================================================ */
window.addEventListener("scroll", ()=>{
  const h = document.documentElement;
  el("readbar").style.width = (h.scrollTop/(h.scrollHeight-h.clientHeight)*100)+"%";
}, { passive:true });

const tocLinks = [...document.querySelectorAll("#toc a")];
const secs = tocLinks.map(a=>document.querySelector(a.getAttribute("href")));
const spy = new IntersectionObserver(es=>{
  es.forEach(e=>{
    const i = secs.indexOf(e.target);
    if (i<0) return;
    if (e.isIntersecting){ tocLinks.forEach(l=>l.classList.remove("active")); tocLinks[i].classList.add("active"); tocLinks[i].classList.add("seen"); }
  });
}, { rootMargin:"-20% 0px -65% 0px" });
secs.forEach(s=> s && spy.observe(s));

document.addEventListener("keydown", e=>{
  if (e.target.tagName==="INPUT"||e.target.tagName==="TEXTAREA"||e.metaKey||e.ctrlKey) return;
  const cur = tocLinks.findIndex(l=>l.classList.contains("active"));
  if (e.key==="j"){ const n = secs[Math.min(cur+1, secs.length-1)]; if(n) n.scrollIntoView({behavior:"smooth"}); }
  else if (e.key==="k"){ const p = secs[Math.max(cur-1,0)]; if(p) p.scrollIntoView({behavior:"smooth"}); }
  else if (e.key==="g") window.scrollTo({top:0, behavior:"smooth"});
});

el("mark-done").onclick = ()=>{
  const KEY = "sysinternals-progress-v1";
  let p = {};
  try { p = JSON.parse(localStorage.getItem(KEY)) || {}; } catch(_){}
  p["btc-14"] = true;
  localStorage.setItem(KEY, JSON.stringify(p));
  el("mark-done").textContent = "✓ Completed — saved to your hub progress";
  el("mark-done").disabled = true;
};
