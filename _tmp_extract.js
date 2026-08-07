
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

/* ===================== MINIRMQ ENGINE (pure, no DOM) ===================== */
(function(global){

/* ---------------------------------------------------------------------
   1. FRAME CODEC (ch.2) — encode/decode method, header & body frames to
   and from a real byte array, with frame_max chunking of the body.
   --------------------------------------------------------------------- */
const FRAME_METHOD = 1, FRAME_HEADER = 2, FRAME_BODY = 3, FRAME_HEARTBEAT = 8;
const FRAME_END = 0xCE;
const FRAME_OVERHEAD = 8; // type(1) + channel(2) + size(4) + frame-end(1)
const CLASS_BASIC = 60, METHOD_BASIC_PUBLISH = 40;

function encodeFrame(type, channel, payloadBytes){
  const size = payloadBytes.length;
  const buf = new Uint8Array(FRAME_OVERHEAD + size);
  const dv = new DataView(buf.buffer);
  dv.setUint8(0, type);
  dv.setUint16(1, channel);
  dv.setUint32(3, size);
  buf.set(payloadBytes, 7);
  dv.setUint8(7 + size, FRAME_END);
  return buf;
}
function decodeFrame(bytes, offset){
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const type = dv.getUint8(offset);
  const channel = dv.getUint16(offset + 1);
  const size = dv.getUint32(offset + 3);
  const payload = bytes.slice(offset + 7, offset + 7 + size);
  const end = dv.getUint8(offset + 7 + size);
  if (end !== FRAME_END) throw new Error("frame-end octet 0xCE missing/corrupt at offset " + offset);
  return { type, channel, payload, nextOffset: offset + 7 + size + 1 };
}
function decodeAllFrames(bytes){
  const frames = []; let off = 0;
  while (off < bytes.length){
    const f = decodeFrame(bytes, off);
    frames.push(f);
    off = f.nextOffset;
  }
  return frames;
}
function encodeMethodPayload(classId, methodId, fields){
  const jsonBytes = new TextEncoder().encode(JSON.stringify(fields));
  const out = new Uint8Array(4 + jsonBytes.length);
  const dv = new DataView(out.buffer);
  dv.setUint16(0, classId); dv.setUint16(2, methodId);
  out.set(jsonBytes, 4);
  return out;
}
function decodeMethodPayload(payload){
  const dv = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
  const classId = dv.getUint16(0), methodId = dv.getUint16(2);
  const fields = JSON.parse(new TextDecoder().decode(payload.slice(4)));
  return { classId, methodId, fields };
}
function encodeHeaderPayload(classId, bodySize, properties){
  const jsonBytes = new TextEncoder().encode(JSON.stringify({ bodySize, properties }));
  const out = new Uint8Array(2 + jsonBytes.length);
  const dv = new DataView(out.buffer);
  dv.setUint16(0, classId);
  out.set(jsonBytes, 2);
  return out;
}
function decodeHeaderPayload(payload){
  const dv = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
  const classId = dv.getUint16(0);
  const rest = JSON.parse(new TextDecoder().decode(payload.slice(2)));
  return { classId, bodySize: rest.bodySize, properties: rest.properties };
}
function encodeBodyFrames(channel, bodyBytes, frameMax){
  const maxChunk = frameMax - FRAME_OVERHEAD;
  if (maxChunk <= 0) throw new Error("frame_max too small to carry any body payload");
  const frames = [];
  if (bodyBytes.length === 0){ frames.push(encodeFrame(FRAME_BODY, channel, bodyBytes)); return frames; }
  for (let i = 0; i < bodyBytes.length; i += maxChunk)
    frames.push(encodeFrame(FRAME_BODY, channel, bodyBytes.slice(i, i + maxChunk)));
  return frames;
}
function encodePublish(channel, exchange, routingKey, bodyBytes, properties, frameMax){
  const methodFrame = encodeFrame(FRAME_METHOD, channel, encodeMethodPayload(CLASS_BASIC, METHOD_BASIC_PUBLISH, { exchange, routingKey }));
  const headerFrame = encodeFrame(FRAME_HEADER, channel, encodeHeaderPayload(CLASS_BASIC, bodyBytes.length, properties || {}));
  const bodyFrames = encodeBodyFrames(channel, bodyBytes, frameMax || 4096);
  const all = [methodFrame, headerFrame, ...bodyFrames];
  const total = all.reduce((s,f)=>s+f.length, 0);
  const out = new Uint8Array(total);
  let off = 0; for (const f of all){ out.set(f, off); off += f.length; }
  return { bytes: out, frameCount: all.length };
}
function decodePublish(bytes){
  const frames = decodeAllFrames(bytes);
  const methodFrame = frames.find(f => f.type === FRAME_METHOD);
  const headerFrame = frames.find(f => f.type === FRAME_HEADER);
  const bodyFrames = frames.filter(f => f.type === FRAME_BODY);
  const { fields } = decodeMethodPayload(methodFrame.payload);
  const hdr = decodeHeaderPayload(headerFrame.payload);
  let bodyLen = 0; for (const f of bodyFrames) bodyLen += f.payload.length;
  const body = new Uint8Array(bodyLen);
  let off = 0; for (const f of bodyFrames){ body.set(f.payload, off); off += f.payload.length; }
  return { exchange: fields.exchange, routingKey: fields.routingKey, properties: hdr.properties, bodySize: hdr.bodySize, body, frameCount: frames.length };
}

/* ---------------------------------------------------------------------
   2. ACTOR RUNTIME (ch.1) — a cooperative scheduler: mailboxes, one
   message handled per step, crash isolation, and a supervisor.
   --------------------------------------------------------------------- */
class RtActor {
  constructor(pid, name, obj, supervisorPid){
    this.pid = pid; this.name = name; this.obj = obj;
    this.mailbox = []; this.alive = true; this.paused = false;
    this.supervisorPid = supervisorPid;
  }
}
class ActorRuntime {
  constructor(){ this.actors = new Map(); this.nextPid = 1; this.runnable = []; this.trace = []; }
  spawn(name, obj, supervisorPid){
    const pid = this.nextPid++;
    this.actors.set(pid, new RtActor(pid, name, obj, supervisorPid || null));
    return pid;
  }
  send(pid, msg){
    const a = this.actors.get(pid);
    if (!a || !a.alive) return false;
    a.mailbox.push(msg);
    if (!this.runnable.includes(pid)) this.runnable.push(pid);
    return true;
  }
  kill(pid){ const a = this.actors.get(pid); if (a) a.alive = false; }
  step(){
    while (this.runnable.length){
      const pid = this.runnable.shift();
      const a = this.actors.get(pid);
      if (!a || !a.alive || a.paused || !a.mailbox.length) continue;
      const msg = a.mailbox.shift();
      try {
        a.obj.handle(msg, { pid, send: (p,m) => this.send(p,m) });
        this.trace.push({ pid, name: a.name, event: "handled", type: msg.type });
      } catch (err){
        this._crash(a, err);
      }
      if (a.alive && a.mailbox.length) this.runnable.push(pid);
      return true;
    }
    return false;
  }
  drain(maxSteps){ let n = 0; const cap = maxSteps || 100000; while (this.step() && n < cap) n++; return n; }
  _crash(a, err){
    a.alive = false;
    this.trace.push({ pid: a.pid, name: a.name, event: "CRASH", err: err.message });
    if (a.supervisorPid) this.send(a.supervisorPid, { type: "_DOWN", pid: a.pid, name: a.name, reason: err.message });
  }
}

/* ---------------------------------------------------------------------
   3. TOPIC TRIE + EXCHANGES (ch.3) — direct, fanout, and a real trie for
   topic routing with backtracking over '*' and '#'.
   --------------------------------------------------------------------- */
class TopicTrie {
  constructor(){ this.root = this._node(); }
  _node(){ return { children: new Map(), star: null, hash: null, queues: new Set() }; }
  bind(pattern, queue){
    const words = pattern.split(".");
    let node = this.root;
    for (const w of words){
      if (w === "*"){ if (!node.star) node.star = this._node(); node = node.star; }
      else if (w === "#"){ if (!node.hash) node.hash = this._node(); node = node.hash; }
      else { if (!node.children.has(w)) node.children.set(w, this._node()); node = node.children.get(w); }
    }
    node.queues.add(queue);
  }
  match(routingKey){
    const words = routingKey.split(".");
    const result = new Set();
    const visit = (node, idx) => {
      if (!node) return;
      if (idx === words.length){
        for (const q of node.queues) result.add(q);
        if (node.hash) visit(node.hash, idx); // '#' matching zero remaining words
        return;
      }
      const w = words[idx];
      if (node.children.has(w)) visit(node.children.get(w), idx + 1);
      if (node.star) visit(node.star, idx + 1);
      if (node.hash){
        // '#' matches zero-or-more words: try every split point (backtracking)
        for (let k = idx; k <= words.length; k++) visit(node.hash, k);
      }
    };
    visit(this.root, 0);
    return result;
  }
}

/* ---------------------------------------------------------------------
   4. CREDIT FLOW (ch.9) — real credit counters that block a hop when
   the receiver has not signalled enough processed work to replenish.
   --------------------------------------------------------------------- */
class CreditFlow {
  constructor(initial, replenishBatch){ this.initial = initial; this.replenishBatch = replenishBatch; this.state = new Map(); }
  _get(k){ if (!this.state.has(k)) this.state.set(k, { credit: this.initial, processed: 0 }); return this.state.get(k); }
  trySend(from, to){
    const s = this._get(from + "=>" + to);
    if (s.credit <= 0) return false;
    s.credit--; return true;
  }
  markProcessed(from, to){
    const s = this._get(from + "=>" + to);
    s.processed++;
    if (s.processed >= this.replenishBatch){ s.credit += s.processed; s.processed = 0; }
  }
  credit(from, to){ return this._get(from + "=>" + to).credit; }
}

/* ---------------------------------------------------------------------
   5. QUEUE / CHANNEL / SUPERVISOR ACTOR BEHAVIOURS (ch.4, ch.5, ch.8)
   --------------------------------------------------------------------- */
function makeQueueActor(broker, name, opts){
  const state = {
    name, messages: [], consumers: new Map(),
    ttl: opts.ttl || 0, dlx: opts.dlx || null, maxLength: (opts.maxLength && opts.maxLength > 0) ? opts.maxLength : Infinity
  };
  function checkExpiry(){
    // Head-of-queue TTL: only the FRONT message is ever inspected. A short-TTL
    // message stuck behind a long-TTL head simply waits — this is the real,
    // deliberate gotcha, not a bug.
    while (state.messages.length && state.ttl > 0 && (broker.now() - state.messages[0].insertedAt) >= state.ttl){
      const dead = state.messages.shift();
      broker.deadLetter(name, dead, "expired");
    }
  }
  function attemptDeliver(){
    checkExpiry();
    for (const [channelId, consumer] of state.consumers){
      while (state.messages.length && consumer.outstanding.length < consumer.prefetch){
        checkExpiry();
        if (!state.messages.length) break;
        const msg = state.messages.shift();
        const tag = broker.nextDeliveryTag++;
        const delivered = { ...msg, deliveryTag: tag };
        consumer.outstanding.push(delivered);
        const chPid = broker.channels.get(channelId);
        if (chPid) broker.rt.send(chPid, { type: "DELIVER", queue: name, message: delivered });
      }
    }
  }
  return {
    state,
    handle(msg){
      if (msg.type === "_INJECT_CRASH") throw new Error('queue actor "' + name + '" crashed (simulated failure)');
      if (msg.type === "ENQUEUE"){
        broker.creditFlow.markProcessed("channel:" + msg.fromChannel, "queue:" + name);
        if (state.messages.length >= state.maxLength){
          const dropped = state.messages.shift();
          broker.deadLetter(name, dropped, "maxlen");
        }
        state.messages.push(msg.message);
        attemptDeliver();
        return;
      }
      if (msg.type === "CONSUME"){
        state.consumers.set(msg.channelId, { prefetch: msg.prefetch || 1, outstanding: [] });
        attemptDeliver();
        return;
      }
      if (msg.type === "ACK"){
        const c = state.consumers.get(msg.channelId); if (!c) return;
        const i = c.outstanding.findIndex(m => m.id === msg.msgId);
        if (i >= 0) c.outstanding.splice(i, 1);
        attemptDeliver();
        return;
      }
      if (msg.type === "NACK"){
        const c = state.consumers.get(msg.channelId); if (!c) return;
        const i = c.outstanding.findIndex(m => m.id === msg.msgId);
        if (i < 0) return;
        const [m] = c.outstanding.splice(i, 1);
        if (msg.requeue) state.messages.unshift(m);
        else broker.deadLetter(name, m, "rejected");
        attemptDeliver();
        return;
      }
      if (msg.type === "CHANNEL_DOWN"){
        const c = state.consumers.get(msg.channelId); if (!c) return;
        for (let i = c.outstanding.length - 1; i >= 0; i--) state.messages.unshift(c.outstanding[i]);
        state.consumers.delete(msg.channelId);
        attemptDeliver();
        return;
      }
      if (msg.type === "TICK"){
        // a clock advance with no other traffic: just re-check the head for TTL expiry
        attemptDeliver();
        return;
      }
      throw new Error("queue actor got unknown message type: " + msg.type);
    }
  };
}
function makeChannelActor(broker, channelId){
  const state = { id: channelId, unacked: new Map() };
  return {
    state,
    handle(msg){
      if (msg.type === "DELIVER"){
        state.unacked.set(msg.message.deliveryTag, { queue: msg.queue, msgId: msg.message.id });
        broker.deliveryLog.push({ channelId, queue: msg.queue, msgId: msg.message.id, tag: msg.message.deliveryTag, body: msg.message.body, ts: broker.now() });
        return;
      }
      throw new Error("channel actor got unknown message type: " + msg.type);
    }
  };
}
function makeSupervisorActor(broker){
  return {
    state: { restarts: 0 },
    handle(msg){
      if (msg.type === "_DOWN"){
        const name = broker.queuePidToName.get(msg.pid);
        if (!name) return;
        const opts = broker.queueOpts.get(name) || {};
        const newPid = broker.rt.spawn(name, makeQueueActor(broker, name, opts), broker.supervisorPid);
        broker.queuePids.set(name, newPid);
        broker.queuePidToName.set(newPid, name);
        this.state.restarts++;
        broker.events.push({ t: "ok", m: 'supervisor restarted queue actor "' + name + '" (pid ' + msg.pid + ' -> ' + newPid + ') after: ' + msg.reason });
        return;
      }
      throw new Error("supervisor got unknown message: " + msg.type);
    }
  };
}

/* ---------------------------------------------------------------------
   6. BROKER — wires everything together
   --------------------------------------------------------------------- */
class Broker {
  constructor(){
    this.rt = new ActorRuntime();
    this.exchanges = new Map();
    this.queuePids = new Map(); this.queuePidToName = new Map(); this.queueOpts = new Map();
    this.channels = new Map();
    this.nextMsgId = 1; this.nextDeliveryTag = 1;
    this.clock = 0;
    this.creditFlow = new CreditFlow(20, 10);
    this.wireLog = []; this.deliveryLog = []; this.events = [];
    this.supervisorPid = this.rt.spawn("supervisor", makeSupervisorActor(this), null);
  }
  now(){ return this.clock; }
  advanceClock(ms){
    this.clock += ms;
    for (const pid of this.queuePids.values()) this.rt.send(pid, { type: "TICK" });
    this.rt.drain();
  }
  declareExchange(name, type){
    if (!["direct","fanout","topic"].includes(type)) throw new Error("unknown exchange type: " + type);
    this.exchanges.set(name, { type, direct: new Map(), fanoutSet: new Set(), trie: new TopicTrie(), bindings: [] });
  }
  declareQueue(name, opts){
    opts = opts || {};
    if (this.queuePids.has(name)) throw new Error("queue exists: " + name);
    this.queueOpts.set(name, opts);
    const pid = this.rt.spawn(name, makeQueueActor(this, name, opts), this.supervisorPid);
    this.queuePids.set(name, pid); this.queuePidToName.set(pid, name);
    return name;
  }
  bind(exchangeName, queueName, pattern){
    const ex = this.exchanges.get(exchangeName);
    if (!ex) throw new Error("no such exchange: " + exchangeName);
    if (!this.queuePids.has(queueName)) throw new Error("no such queue: " + queueName);
    ex.bindings.push({ queue: queueName, pattern: pattern || "" });
    if (ex.type === "direct"){ if (!ex.direct.has(pattern)) ex.direct.set(pattern, new Set()); ex.direct.get(pattern).add(queueName); }
    else if (ex.type === "fanout"){ ex.fanoutSet.add(queueName); }
    else { ex.trie.bind(pattern || "#", queueName); }
  }
  routeMessage(exchangeName, routingKey){
    const ex = this.exchanges.get(exchangeName);
    if (!ex) throw new Error("no such exchange: " + exchangeName);
    if (ex.type === "direct") return [...(ex.direct.get(routingKey) || [])];
    if (ex.type === "fanout") return [...ex.fanoutSet];
    return [...ex.trie.match(routingKey)];
  }
  ensureChannel(channelId){
    if (!this.channels.has(channelId)){
      const pid = this.rt.spawn("channel-" + channelId, makeChannelActor(this, channelId), null);
      this.channels.set(channelId, pid);
    }
    return this.channels.get(channelId);
  }
  publish(channelId, exchangeName, routingKey, bodyStr, opts){
    opts = opts || {};
    this.ensureChannel(channelId);
    const bodyBytes = new TextEncoder().encode(bodyStr);
    const properties = { persistent: !!opts.persistent, confirm: !!opts.confirm };
    const frameMax = opts.frameMax || 4096;
    const enc = encodePublish(channelId, exchangeName, routingKey, bodyBytes, properties, frameMax);
    this.wireLog.push({ channelId, exchange: exchangeName, routingKey, bytes: enc.bytes.length, frames: enc.frameCount, ts: this.now() });
    const dec = decodePublish(enc.bytes); // genuinely re-parsed from the bytes just produced
    const targets = this.routeMessage(dec.exchange, dec.routingKey);
    if (!targets.length){
      this.events.push({ t: "warn", m: 'published to "' + exchangeName + '" key "' + routingKey + '" — unroutable, no binding matched' });
      return { routed: 0, blocked: false, frameBytes: enc.bytes.length, frameCount: enc.frameCount };
    }
    let anyBlocked = false;
    const drain = opts.drain !== false;
    for (const qname of targets){
      const qpid = this.queuePids.get(qname);
      const ok = this.creditFlow.trySend("channel:" + channelId, "queue:" + qname);
      if (!ok){ anyBlocked = true; this.events.push({ t: "err", m: "BLOCKED: credit exhausted channel:" + channelId + " -> queue:" + qname }); continue; }
      const message = { id: this.nextMsgId++, body: dec.body, properties: dec.properties, routingKey: dec.routingKey, exchange: dec.exchange, insertedAt: this.now(), xDeath: [] };
      this.rt.send(qpid, { type: "ENQUEUE", fromChannel: channelId, message });
    }
    if (drain) this.rt.drain();
    return { routed: targets.length, blocked: anyBlocked, frameBytes: enc.bytes.length, frameCount: enc.frameCount };
  }
  consume(queueName, channelId, prefetch){
    this.ensureChannel(channelId);
    const qpid = this.queuePids.get(queueName);
    if (!qpid) throw new Error("no such queue: " + queueName);
    this.rt.send(qpid, { type: "CONSUME", channelId, prefetch: prefetch || 1 });
    this.rt.drain();
  }
  ack(tag){
    for (const [cid, pid] of this.channels){
      const ch = this.rt.actors.get(pid).obj.state;
      if (ch.unacked.has(tag)){
        const { queue, msgId } = ch.unacked.get(tag);
        ch.unacked.delete(tag);
        this.rt.send(this.queuePids.get(queue), { type: "ACK", channelId: cid, msgId });
        this.rt.drain();
        return { channelId: cid, queue, msgId };
      }
    }
    throw new Error("unknown delivery tag: " + tag);
  }
  nack(tag, requeue){
    for (const [cid, pid] of this.channels){
      const ch = this.rt.actors.get(pid).obj.state;
      if (ch.unacked.has(tag)){
        const { queue, msgId } = ch.unacked.get(tag);
        ch.unacked.delete(tag);
        this.rt.send(this.queuePids.get(queue), { type: "NACK", channelId: cid, msgId, requeue: !!requeue });
        this.rt.drain();
        return { channelId: cid, queue, msgId };
      }
    }
    throw new Error("unknown delivery tag: " + tag);
  }
  killChannel(channelId){
    const pid = this.channels.get(channelId);
    if (!pid) throw new Error("no such channel: " + channelId);
    for (const qpid of this.queuePids.values()) this.rt.send(qpid, { type: "CHANNEL_DOWN", channelId });
    this.rt.drain();
    this.rt.kill(pid);
    this.channels.delete(channelId);
    return { channelId };
  }
  killQueue(name){
    const pid = this.queuePids.get(name);
    if (!pid) throw new Error("no such queue: " + name);
    this.rt.send(pid, { type: "_INJECT_CRASH" });
    this.rt.drain();
    return { name };
  }
  deadLetter(originalQueueName, message, reason){
    const already = message.xDeath.find(d => d.queue === originalQueueName && d.reason === reason);
    let xDeath;
    if (already) xDeath = message.xDeath.map(d => d === already ? { ...d, count: d.count + 1, time: this.now() } : d);
    else xDeath = [...message.xDeath, { queue: originalQueueName, reason, exchange: message.exchange || "", "routing-keys": [message.routingKey], count: 1, time: this.now() }];
    const qopts = this.queueOpts.get(originalQueueName);
    if (qopts && qopts.dlx){
      const targets = this.routeMessage(qopts.dlx, message.routingKey);
      if (!targets.length) this.events.push({ t: "warn", m: 'DLX "' + qopts.dlx + '" has no binding matching "' + message.routingKey + '" — dead letter dropped' });
      for (const qn of targets){
        const qpid = this.queuePids.get(qn);
        if (!qpid) continue;
        const dead = { ...message, id: this.nextMsgId++, insertedAt: this.now(), xDeath };
        this.rt.send(qpid, { type: "ENQUEUE", fromChannel: null, message: dead });
      }
    } else {
      this.events.push({ t: "warn", m: 'message dead-lettered from "' + originalQueueName + '" (reason: ' + reason + ') — no DLX configured, dropped' });
    }
  }
  inspectSummary(){
    const exchanges = [...this.exchanges.entries()].map(([name, ex]) => ({ name, type: ex.type, bindings: ex.bindings }));
    const queues = [...this.queuePids.entries()].map(([name, pid]) => {
      const st = this.rt.actors.get(pid).obj.state;
      return {
        name, depth: st.messages.length, ttl: st.ttl || null, dlx: st.dlx || null,
        maxLength: isFinite(st.maxLength) ? st.maxLength : null,
        consumers: [...st.consumers.entries()].map(([cid, c]) => ({ channelId: cid, prefetch: c.prefetch, unacked: c.outstanding.length }))
      };
    });
    return { exchanges, queues, credit: [...this.creditFlow.state.entries()] };
  }
}
function createBroker(){ return new Broker(); }

global.MiniRMQ = {
  encodeFrame, decodeFrame, decodeAllFrames,
  encodeMethodPayload, decodeMethodPayload, encodeHeaderPayload, decodeHeaderPayload,
  encodeBodyFrames, encodePublish, decodePublish, FRAME_OVERHEAD,
  TopicTrie, CreditFlow, ActorRuntime,
  makeQueueActor, makeChannelActor, makeSupervisorActor,
  Broker, createBroker
};
})(typeof window !== "undefined" ? window : globalThis);
/* ===================== END MINIRMQ ENGINE ===================== */

/* ===================== CONSOLE: parses the command grammar and drives MiniRMQ ===================== */
(function(global){
  function tokenize(text){
    const out = []; let cur = ""; let q = null;
    for (let i = 0; i < text.length; i++){
      const c = text[i];
      if (q){ if (c === q){ q = null; } else cur += c; continue; }
      if (c === '"' || c === "'"){ q = c; continue; }
      if (/\s/.test(c)){ if (cur){ out.push(cur); cur = ""; } continue; }
      cur += c;
    }
    if (cur) out.push(cur);
    return out;
  }
  const BOOL_FLAGS = new Set(["persistent","confirm","requeue"]);
  function parseFlags(tokens){
    const positional = []; const flags = {};
    for (let i = 0; i < tokens.length; i++){
      const t = tokens[i];
      if (t.startsWith("--")){
        const name = t.slice(2);
        if (BOOL_FLAGS.has(name)) flags[name] = true;
        else flags[name] = tokens[++i];
      } else positional.push(t);
    }
    return { positional, flags };
  }
  function runCommand(broker, consoleState, raw){
    const text = raw.trim();
    if (!text) return [];
    const tokens = tokenize(text);
    const cmd = tokens[0];
    const rest = tokens.slice(1);
    const out = [];
    try {
      if (cmd === "declare-exchange"){
        const { positional } = parseFlags(rest);
        const [name, type] = positional;
        if (!name || !type) throw new Error("usage: declare-exchange <name> <direct|fanout|topic>");
        broker.declareExchange(name, type);
        out.push({ t: "ok", m: 'exchange "' + name + '" declared (type=' + type + ')' });
        return out;
      }
      if (cmd === "declare-queue"){
        const { positional, flags } = parseFlags(rest);
        const [name] = positional;
        if (!name) throw new Error("usage: declare-queue <name> [--ttl N] [--dlx X] [--max-length N]");
        const opts = {};
        if (flags.ttl !== undefined) opts.ttl = Number(flags.ttl);
        if (flags.dlx !== undefined) opts.dlx = flags.dlx;
        if (flags["max-length"] !== undefined) opts.maxLength = Number(flags["max-length"]);
        broker.declareQueue(name, opts);
        out.push({ t: "ok", m: 'queue "' + name + '" declared' + (opts.ttl ? (" ttl=" + opts.ttl + "ms") : "") + (opts.dlx ? (" dlx=" + opts.dlx) : "") + (opts.maxLength ? (" max-length=" + opts.maxLength) : "") });
        return out;
      }
      if (cmd === "bind"){
        const { positional } = parseFlags(rest);
        const [exchange, queue, pattern] = positional;
        if (!exchange || !queue) throw new Error("usage: bind <exchange> <queue> <pattern>");
        broker.bind(exchange, queue, pattern || "");
        out.push({ t: "ok", m: "bound " + exchange + " -> " + queue + ' (pattern "' + (pattern || "") + '")' });
        return out;
      }
      if (cmd === "publish"){
        const { positional, flags } = parseFlags(rest);
        const [exchange, routingKey, ...bodyParts] = positional;
        if (!exchange || !routingKey) throw new Error("usage: publish <exchange> <routing-key> <body> [--persistent] [--confirm]");
        const body = bodyParts.join(" ") || "";
        const channelId = 0; // shared publisher channel for console commands
        const r = broker.publish(channelId, exchange, routingKey, body, { persistent: !!flags.persistent, confirm: !!flags.confirm });
        if (r.blocked) out.push({ t: "err", m: "PUBLISH blocked — credit exhausted on channel:" + channelId + " -> queue hop; message not accepted" });
        else if (!r.routed) out.push({ t: "warn", m: "PUBLISH unroutable — no binding matched \"" + routingKey + '" on "' + exchange + '"' });
        else out.push({ t: "ok", m: "PUBLISH ok — routed to " + r.routed + " queue(s), " + r.frameCount + " frame(s), " + r.frameBytes + " byte(s) on the wire" + (flags.confirm ? " [confirmed]" : "") });
        return out;
      }
      if (cmd === "consume"){
        const { positional, flags } = parseFlags(rest);
        const [queue] = positional;
        if (!queue) throw new Error("usage: consume <queue> [--prefetch N]");
        const prefetch = flags.prefetch !== undefined ? Number(flags.prefetch) : 1;
        const channelId = consoleState.nextConsumerChannel++;
        broker.consume(queue, channelId, prefetch);
        out.push({ t: "ok", m: "channel " + channelId + ' now consuming "' + queue + '" (prefetch=' + prefetch + ")" });
        return out;
      }
      if (cmd === "ack"){
        const { positional } = parseFlags(rest);
        const tag = Number(positional[0]);
        const r = broker.ack(tag);
        out.push({ t: "ok", m: "ACK tag " + tag + " (channel " + r.channelId + ", queue " + r.queue + ")" });
        return out;
      }
      if (cmd === "nack"){
        const { positional, flags } = parseFlags(rest);
        const tag = Number(positional[0]);
        const r = broker.nack(tag, !!flags.requeue);
        out.push({ t: "ok", m: "NACK tag " + tag + (flags.requeue ? " requeue=true" : " requeue=false") + " (channel " + r.channelId + ", queue " + r.queue + ")" });
        return out;
      }
      if (cmd === "kill-channel"){
        const { positional } = parseFlags(rest);
        const id = Number(positional[0]);
        broker.killChannel(id);
        out.push({ t: "err", m: "*** channel " + id + " killed *** any unacked messages requeued to their queues" });
        return out;
      }
      if (cmd === "kill-queue"){
        const { positional } = parseFlags(rest);
        const [name] = positional;
        broker.killQueue(name);
        out.push({ t: "err", m: '*** queue actor "' + name + '" crashed *** supervisor will restart it' });
        return out;
      }
      if (cmd === "slow-consumer"){
        const { positional } = parseFlags(rest);
        const id = Number(positional[0]);
        consoleState.slow.add(id);
        out.push({ t: "warn", m: "channel " + id + " marked as a slow consumer (labelling only — stop acking it manually to see the effect)" });
        return out;
      }
      if (cmd === "inspect"){
        out.push({ t: "out", m: JSON.stringify(broker.inspectSummary(), null, 2) });
        return out;
      }
      throw new Error("unrecognized command: " + cmd);
    } catch (e){
      out.push({ t: "err", m: e.message });
      return out;
    }
  }
  global.MiniRMQConsole = { run: runCommand, tokenize, parseFlags };
})(typeof window !== "undefined" ? window : globalThis);
/* ============================================================
   1. TIMELINE (§2)
   ============================================================ */
const TL12 = [
  { yr:"1970s-80s", l:"Actor model theory", d:"<b>Carl Hewitt's Actor Model</b> (1973) formalized the idea this chapter's actor runtime borrows directly: independent units of computation with private state, communicating only via asynchronous messages. Erlang's designers at Ericsson built on exactly this theory a decade later when they needed a language for telecom switches that must never let one call crash the whole exchange." },
  { yr:"2003", l:"AMQP's banking origin", d:"Chapter 1's origin story: JPMorgan Chase's messaging sprawl motivates a vendor-neutral WIRE protocol, not a Java API. Small reference implementations proved the spec before any production-scale broker existed." },
  { yr:"2007", l:"RabbitMQ 1.0 ships", d:"LShift and CohesiveFT ship the first RabbitMQ release on Erlang/OTP — itself, at the time, a small implementation of a young spec, not the mature multi-protocol broker it is today." },
  { yr:"2010s", l:"'Build your own Redis/queue' genre", d:"A wave of widely-read tutorials and small projects (toy pub/sub systems, minimal actor runtimes, miniature broker clones) makes 'implement the pieces yourself' a mainstream way to learn messaging internals — this chapter is a more rigorous, course-integrated descendant of that genre." },
  { yr:"2010s-20s", l:"Teaching actor runtimes", d:"University concurrency courses regularly assign a small cooperative actor scheduler as a teaching exercise — mailboxes, one message at a time, crash isolation — precisely the shape of §9's <code>ActorRuntime</code>, because it's the smallest system that makes the guarantee tangible rather than assumed." },
  { yr:"today", l:"you, right now", d:"<b>This chapter.</b> Same lineage: build small, build real, build enough of it that a genuine channel-kill-and-requeue test, or a genuine credit-exhaustion block, can pass or fail on its own merits — not because the material says it should." }
];
const tl12Track = el("tl12-track"), tl12Detail = el("tl12-detail");
TL12.forEach((t,i)=>{
  const item = document.createElement("div");
  item.className = "tl-item" + (i===1 ? " on" : "");
  item.innerHTML = `<div class="tl-dot"></div><div class="tl-yr">${t.yr}</div><div class="tl-l">${t.l}</div>`;
  item.onclick = ()=>{ [...tl12Track.children].forEach(c=>c.classList.remove("on")); item.classList.add("on"); tl12Detail.innerHTML = t.d; };
  tl12Track.appendChild(item);
});
tl12Detail.innerHTML = TL12[1].d;

/* ============================================================
   2. DECK: deriving the architecture (§5)
   ============================================================ */
(function(){
  const box = (t,c,ok) => `<div style="border:1px solid ${ok?'var(--ok)':'var(--border-hi)'};border-radius:12px;padding:16px;max-width:540px;margin:0 auto">
    <div style="font-family:var(--mono);font-size:11px;color:${ok?'var(--ok)':'var(--pg)'};letter-spacing:.08em;margin-bottom:8px">${t}</div>
    <div style="font-size:13px;color:#c6cddb;line-height:1.7">${c}</div></div>`;
  stepper("deckDerive", [
    { stage: box("CANDIDATE A — separate objects, still direct calls", "Every queue gets its own array + subscriber list. Producers address by name instead of holding a callback directly. Fixes coupling from §4."),
      cap:`<b>Fixes addressing, not isolation.</b> Everything still runs on the publisher's own call stack. A slow consumer's work still happens inline with the publish that triggered it.` },
    { stage: box("CANDIDATE B — queues as actors, no encoding", "Each queue gets a mailbox and its own turn to run. A publish is still a raw JS object handed across an in-memory channel — never actual bytes.", true),
      cap:`<b>Correct instinct on isolation — this IS chapter 1's fix.</b> But there's no byte representation at all, so this design could never talk to a real socket, and there's still no routing indirection. Missing piece: a real frame codec AND a real exchange/binding layer.` },
    { stage: box("CANDIDATE C — actors + framing + routing, fire-and-forget delivery", "Add the frame codec and direct/fanout/topic exchanges in front of the queue actors. Delivery is still 'send it and hope' — no delivery tag, no unacked set, no cap.", true),
      cap:`<b>Correct wire model and routing.</b> But nothing tracks which messages are outstanding, nothing caps how many, and nothing signals a publisher to slow down. Missing piece: ack tracking, prefetch, and credit flow.` },
    { stage: box("FINAL: 6 components — frame codec, actors, exchanges/trie, queue+acks, credit flow, DLX/TTL", "Every gap from §4 and §6 is now closed by a specific, named mechanism.", true),
      cap:`§7 assembles all six into one dependency graph and §8–§12 build each one as real, runnable JavaScript.` }
  ]);
})();

/* ============================================================
   3. ARCHITECTURE EXPLORER (§7)
   ============================================================ */
const ARCH12 = {
  frame:{ n:"Frame codec", f:"real analog: rabbit_binary_generator.erl / rabbit_binary_parser.erl (ch.2)", r:"Encode/decode method, header, and body frames to/from a byte array, with frame_max chunking of the body.", l:"Depends on nothing else in this list — the substrate everything else rides on.", d:"Every publish in §11–§15 is genuinely encoded and decoded through this before it ever reaches routing." },
  actor:{ n:"Actor runtime", f:"real analog: the BEAM scheduler + OTP supervisors (ch.1)", r:"A cooperative scheduler: mailboxes, one message handled per turn, crash isolation, and a one_for_one supervisor.", l:"Depends on nothing else — foundational.", d:"Every queue, channel, and the supervisor itself are actors spawned on this runtime; §12's credit flow and §11's ack tracking both ride on actor message-passing." },
  exch:{ n:"Exchanges + topic trie", f:"real analog: rabbit_exchange_type_{direct,fanout,topic}.erl (ch.3)", r:"Direct (map lookup), fanout (set), and topic (a real trie with '*' / '#' backtracking) routing.", l:"Depends on the actor runtime only insofar as queues (its routing targets) are actors.", d:"§11's queue actors receive ENQUEUE messages only because this layer resolved a routing key into a queue name first; §12's DLX routing reuses the exact same routeMessage() function." },
  queue:{ n:"Queue actors + acks", f:"real analog: rabbit_channel.erl (unacked map) + rabbit_amqqueue_process.erl (ch.4, ch.5)", r:"Per-queue message lists, per-consumer prefetch caps, delivery tags, requeue-on-channel-death.", l:"Depends on the actor runtime (queues and channels ARE actors) and exchanges (messages arrive already routed).", d:"§12's credit flow gates the exact hop feeding this layer's ENQUEUE handler; §12's dead lettering is called directly from inside this layer's NACK and maxlen-overflow paths." },
  credit:{ n:"Credit flow control", f:"real analog: rabbit_flow.erl (ch.9)", r:"Per-hop credit counters (channel→queue) that block the sender when depleted, replenished in batches by the receiver.", l:"Depends on the actor runtime (it gates actor sends) and queue actors (it's checked before every ENQUEUE).", d:"Nothing downstream depends on it — it's a gate other components consult, not infrastructure they build on." },
  dlx:{ n:"Dead lettering + TTL", f:"real analog: rabbit_dead_letter.erl + per-queue TTL logic (ch.8)", r:"x-death header construction, DLX re-routing through the exchange layer, and lazy head-of-queue TTL expiry.", l:"Depends on queue actors (it's invoked FROM inside NACK/maxlen/TTL paths) and exchanges (DLX routing reuses routeMessage()).", d:"§15's poison-message scenario and TTL scenario are this component, directly exercised end to end." }
};
const arch12Detail = el("arch12-detail");
function showArch12(key){
  const a = ARCH12[key];
  arch12Detail.innerHTML = `<div class="ad-name">${a.n}</div><div class="ad-file">${a.f}</div>
    <div class="ad-sec">ROLE</div>${a.r}<div class="ad-sec">DEPENDS ON</div>${a.l}<div class="ad-sec">WHAT DEPENDS ON IT</div>${a.d}`;
  document.querySelectorAll("#s7 .acard").forEach(c=>c.classList.toggle("sel", c.dataset.p===key));
}
document.querySelectorAll("#s7 .acard").forEach(c=> c.onclick = ()=>showArch12(c.dataset.p));
showArch12("frame");
/* ============================================================
   4. FRAME CODEC WIDGET (§8)
   ============================================================ */
(function(){
  function render(){
    const bodySize = +el("fc-body").value;
    const frameMax = +el("fc-fmax").value;
    el("fc-body-val").textContent = bodySize + " B";
    el("fc-fmax-val").textContent = frameMax + " B";
    el("fc-note").textContent = "";
  }
  el("fc-body").oninput = render;
  el("fc-fmax").oninput = render;
  el("fc-encode").onclick = ()=>{
    const bodySize = +el("fc-body").value;
    const frameMax = +el("fc-fmax").value;
    const body = new Uint8Array(bodySize);
    for (let i=0;i<bodySize;i++) body[i] = 97 + (i % 26); // deterministic filler bytes
    let enc, dec, ok = true, err = "";
    try {
      enc = MiniRMQ.encodePublish(3, "demo-ex", "demo.key", body, { persistent: true }, frameMax);
      dec = MiniRMQ.decodePublish(enc.bytes);
      ok = dec.body.length === body.length;
      for (let i=0;i<body.length && ok;i++) if (dec.body[i] !== body[i]) ok = false;
    } catch(e){ err = e.message; ok = false; }
    if (err){
      el("fc-out").innerHTML = `<span style="color:var(--bad)">encode failed: ${err}</span>`;
      el("fc-note").innerHTML = `frame_max (${frameMax} B) is too small to carry even the frame overhead — real RabbitMQ enforces a 4096-byte protocol floor for exactly this reason.`;
      return;
    }
    const frames = MiniRMQ.decodeAllFrames(enc.bytes);
    const typeName = { 1:"METHOD", 2:"HEADER", 3:"BODY" };
    el("fc-out").innerHTML = frames.map((f,i)=>
      `<div class="frame ${f.type===3?'':'hot'}"><span class="ff">frame ${i+1}/${frames.length}</span> — type=${typeName[f.type]} channel=${f.channel} size=${f.payload.length}B<span class="fl">bytes: [${[...f.payload.slice(0,10)].join(",")}${f.payload.length>10?", …":""}]</span></div>`
    ).join("");
    el("fc-note").innerHTML = ok
      ? `<b style="color:var(--ok)">Round-trip verified:</b> ${body.length} original bytes === ${dec.body.length} decoded bytes, byte-for-byte. ${frames.length} total frames (1 method + 1 header + ${frames.length-2} body frame(s)) at frame_max=${frameMax}B — total ${enc.bytes.length} bytes on the wire.`
      : `<b style="color:var(--bad)">Round-trip MISMATCH</b> — this would be a codec bug.`;
  };
  render();
})();

/* deck: encodePublish/decodePublish source, annotated */
(function(){
  stepper("deckFrame", [
    { stage:`<div class="codeblock" style="margin:0"><div class="cb-head"><span class="lang">js</span><span>encodeFrame()</span></div><pre><span class="k">function</span> <span class="f">encodeFrame</span>(type, channel, payloadBytes) {
  <span class="k">const</span> size = payloadBytes.length;
  <span class="k">const</span> buf = <span class="k">new</span> Uint8Array(<span class="n">8</span> + size);   <span class="c">// 8 = type+channel+size+frame-end overhead</span>
  <span class="k">const</span> dv = <span class="k">new</span> DataView(buf.buffer);
  dv.setUint8(<span class="n">0</span>, type);
  dv.setUint16(<span class="n">1</span>, channel);
  dv.setUint32(<span class="n">3</span>, size);
  buf.set(payloadBytes, <span class="n">7</span>);
  dv.setUint8(<span class="n">7</span> + size, <span class="n">0xCE</span>);      <span class="c">// frame-end octet, real AMQP's corruption check</span>
  <span class="k">return</span> buf;
}</pre></div>`,
      cap:`One frame is a real byte buffer: a 1-byte type, a 2-byte channel number, a 4-byte size, the payload itself, and the fixed trailing octet <code>0xCE</code>. Decoding checks that trailing byte before trusting anything else in the frame.` },
    { stage:`<div class="codeblock" style="margin:0"><div class="cb-head"><span class="lang">js</span><span>encodeBodyFrames() — the frame_max chunking</span></div><pre><span class="k">function</span> <span class="f">encodeBodyFrames</span>(channel, bodyBytes, frameMax) {
  <span class="k">const</span> maxChunk = frameMax - <span class="n">8</span>;              <span class="c">// leave room for this frame's own overhead</span>
  <span class="k">const</span> frames = [];
  <span class="k">for</span> (<span class="k">let</span> i = <span class="n">0</span>; i &lt; bodyBytes.length; i += maxChunk)
    frames.push(encodeFrame(FRAME_BODY, channel, bodyBytes.slice(i, i + maxChunk)));
  <span class="k">return</span> frames;
}</pre></div>`,
      cap:`A large body genuinely becomes many separate frames — no single frame ever exceeds <code>frame_max</code>. This is why a huge message never needs one unbounded allocation on the receiving side: it can pre-size from the header frame's announced body size and fill it in chunks as body frames arrive.` },
    { stage:`<div class="codeblock" style="margin:0"><div class="cb-head"><span class="lang">js</span><span>decodePublish() — genuinely re-parsed</span></div><pre><span class="k">function</span> <span class="f">decodePublish</span>(bytes) {
  <span class="k">const</span> frames = decodeAllFrames(bytes);            <span class="c">// walk the byte array frame by frame</span>
  <span class="k">const</span> methodFrame = frames.find(f => f.type === FRAME_METHOD);
  <span class="k">const</span> bodyFrames = frames.filter(f => f.type === FRAME_BODY);
  <span class="k">let</span> body = <span class="k">new</span> Uint8Array(bodyFrames.reduce((s,f)=>s+f.payload.length,<span class="n">0</span>));
  <span class="k">let</span> off = <span class="n">0</span>;
  <span class="k">for</span> (<span class="k">const</span> f <span class="k">of</span> bodyFrames) { body.set(f.payload, off); off += f.payload.length; }
  <span class="k">return</span> { <span class="c">/* exchange, routingKey, properties, body */</span> };
}</pre></div>`,
      cap:`This is not a mock — it's the exact function §11's <code>publish()</code> calls on the bytes it JUST produced, before routing even begins. The body frames are reassembled in order into one contiguous buffer, which is what makes the widget's byte-for-byte round-trip assertion meaningful rather than decorative.` }
  ]);
})();
/* ============================================================
   5. ACTOR RUNTIME WIDGET (§9)
   ============================================================ */
(function(){
  const rt = new MiniRMQ.ActorRuntime();
  let queuePid = null, supPid = null, msgCount = 0, restarts = 0;
  function makeDemoQueue(){
    return { state:{ received:0 }, handle(msg){
      if (msg.type === "_INJECT_CRASH") throw new Error("simulated crash");
      this.state.received++;
    }};
  }
  function makeDemoSupervisor(){
    return { state:{}, handle(msg){
      if (msg.type === "_DOWN"){
        restarts++;
        queuePid = rt.spawn("demo-queue", makeDemoQueue(), supPid);
        render(`supervisor: ${'"'}demo-queue${'"'} crashed (${msg.reason}) — restarted as a FRESH actor (pid ${queuePid}). old mailbox and state: gone.`);
      }
    }};
  }
  function render(note){
    const box = el("ar-tree");
    let html = "";
    if (supPid !== null){
      const sup = rt.actors.get(supPid);
      html += `<div class="snode pm">supervisor (pid ${supPid})<span class="st">restarts: ${restarts}</span></div>`;
    }
    if (queuePid !== null){
      const q = rt.actors.get(queuePid);
      const alive = q && q.alive;
      html += `<div class="snode ${alive?'new':'crash'}">queue actor (pid ${queuePid})<span class="st">${alive ? 'received: '+q.obj.state.received+' · mailbox: '+q.mailbox.length : 'DEAD'}</span></div>`;
    }
    box.innerHTML = html || `<span style="color:var(--dim);font-family:var(--mono);font-size:12px">spawn a queue actor to begin</span>`;
    if (note) el("ar-note").innerHTML = note;
  }
  el("ar-spawn").onclick = ()=>{
    rt.actors.clear(); rt.runnable = []; rt.nextPid = 1; restarts = 0; msgCount = 0;
    supPid = rt.spawn("supervisor", makeDemoSupervisor(), null);
    queuePid = rt.spawn("demo-queue", makeDemoQueue(), supPid);
    render(`spawned a supervisor (pid ${supPid}) and a queue actor (pid ${queuePid}) under it — exactly <code>rt.spawn(name, obj, supervisorPid)</code>.`);
  };
  el("ar-msg").onclick = ()=>{
    if (queuePid === null){ render(`spawn a queue actor first.`); return; }
    rt.send(queuePid, { type: "PING" });
    rt.drain();
    msgCount++;
    render(`sent message #${msgCount} into the queue actor's mailbox; <code>rt.drain()</code> processed it — one message, one turn.`);
  };
  el("ar-crash").onclick = ()=>{
    if (queuePid === null){ render(`spawn a queue actor first.`); return; }
    rt.send(queuePid, { type: "_INJECT_CRASH" });
    rt.drain();
    render();
  };
  el("ar-reset").onclick = ()=>{ queuePid = null; supPid = null; restarts = 0; msgCount = 0; render(`reset.`); };
  render();
})();

/* deck: ActorRuntime.step(), annotated */
(function(){
  stepper("deckActor", [
    { stage:`<div class="codeblock" style="margin:0"><div class="cb-head"><span class="lang">js</span><span>send() — push into a mailbox</span></div><pre>send(pid, msg) {
  <span class="k">const</span> a = <span class="k">this</span>.actors.get(pid);
  <span class="k">if</span> (!a || !a.alive) <span class="k">return</span> <span class="k">false</span>;
  a.mailbox.push(msg);                       <span class="c">// just an array push — no shared memory touched</span>
  <span class="k">if</span> (!<span class="k">this</span>.runnable.includes(pid)) <span class="k">this</span>.runnable.push(pid);
  <span class="k">return</span> <span class="k">true</span>;
}</pre></div>`,
      cap:`Sending a message never runs the receiver's code — it only appends to that actor's OWN mailbox array and marks it runnable. The sender's call stack returns immediately; there is no shared object here for two actors to race on.` },
    { stage:`<div class="codeblock" style="margin:0"><div class="cb-head"><span class="lang">js</span><span>step() — one message, one actor, one turn</span></div><pre>step() {
  <span class="k">const</span> pid = <span class="k">this</span>.runnable.shift();
  <span class="k">const</span> a = <span class="k">this</span>.actors.get(pid);
  <span class="k">const</span> msg = a.mailbox.shift();
  <span class="k">try</span> { a.obj.handle(msg, ctx); }
  <span class="k">catch</span> (err) { <span class="k">this</span>._crash(a, err); }   <span class="c">// the ONLY way a bug here can propagate</span>
}</pre></div>`,
      cap:`Exactly one message is handled per call. If <code>handle()</code> throws, the exception is caught right here — it can never unwind into any OTHER actor's turn, because there is no shared call stack to unwind through.` },
    { stage:`<div class="codeblock" style="margin:0"><div class="cb-head"><span class="lang">js</span><span>_crash() — notify the supervisor, nothing else</span></div><pre>_crash(a, err) {
  a.alive = <span class="k">false</span>;
  <span class="k">if</span> (a.supervisorPid)
    <span class="k">this</span>.send(a.supervisorPid, { type: <span class="s">"_DOWN"</span>, pid: a.pid, reason: err.message });
}</pre></div>`,
      cap:`The crashed actor is marked dead — its mailbox and state are simply abandoned. Exactly one message, <code>_DOWN</code>, goes to its supervisor. Every sibling actor's mailbox, state, and aliveness are completely untouched, because none of them were ever reachable FROM the crash in the first place.` }
  ]);
})();
/* ============================================================
   6. TOPIC TRIE WIDGET (§10)
   ============================================================ */
(function(){
  let trie = new MiniRMQ.TopicTrie();
  let nextQ = 1;
  const bindings = [];
  function seed(){
    trie = new MiniRMQ.TopicTrie(); nextQ = 1; bindings.length = 0;
    [["stock.#","q1"],["*.usd.*","q2"],["stock.*.nyse","q3"],["stock.eur.#","q4"]].forEach(([p,q])=>{
      trie.bind(p,q); bindings.push({p,q}); nextQ++;
    });
  }
  function renderNode(node, tokens){
    let html = "";
    for (const [word, child] of node.children){
      html += `<div class="trie-node"><span class="trie-tok">${word}</span>${child.queues.size?`<span class="trie-q">→ ${[...child.queues].join(",")}</span>`:""}${renderNode(child, [...tokens,word])}</div>`;
    }
    if (node.star) html += `<div class="trie-node"><span class="trie-tok star">*</span>${node.star.queues.size?`<span class="trie-q">→ ${[...node.star.queues].join(",")}</span>`:""}${renderNode(node.star,[...tokens,"*"])}</div>`;
    if (node.hash) html += `<div class="trie-node"><span class="trie-tok hash">#</span>${node.hash.queues.size?`<span class="trie-q">→ ${[...node.hash.queues].join(",")}</span>`:""}${renderNode(node.hash,[...tokens,"#"])}</div>`;
    return html;
  }
  function render(){
    el("tx-tree").innerHTML = `<div style="color:var(--dim);font-size:10.5px;margin-bottom:6px">(root)</div>` + renderNode(trie.root, []);
  }
  el("tx-add").onclick = ()=>{
    const pattern = el("tx-pattern").value.trim() || "#";
    const q = "q" + (nextQ++);
    trie.bind(pattern, q);
    bindings.push({p:pattern,q});
    render();
    el("tx-result").innerHTML = `bound <b style="color:var(--pg)">${pattern}</b> → new queue <b style="color:var(--ok)">${q}</b>`;
  };
  el("tx-test").onclick = ()=>{
    const key = el("tx-key").value.trim();
    const matched = [...trie.match(key)];
    el("tx-result").innerHTML = `routing key <b>${key}</b> matches: ` + (matched.length ? matched.map(q=>`<span class="tag" style="color:var(--ok);border-color:rgba(74,222,128,.4)">${q}</span>`).join(" ") : `<span style="color:var(--dim)">nothing — unroutable</span>`);
  };
  el("tx-reset").onclick = ()=>{ seed(); render(); el("tx-result").innerHTML = "reset to the four canonical bindings from this section's prose."; };
  seed(); render();
  el("tx-result").innerHTML = `seeded with <code>stock.#</code>→q1, <code>*.usd.*</code>→q2, <code>stock.*.nyse</code>→q3, <code>stock.eur.#</code>→q4. Click "route it" to test <code>stock.usd.nyse</code>.`;
})();

/* deck: TopicTrie.match(), annotated */
(function(){
  stepper("deckTrie", [
    { stage:`<div class="codeblock" style="margin:0"><div class="cb-head"><span class="lang">js</span><span>the base case — end of the routing key</span></div><pre><span class="k">if</span> (idx === words.length) {
  <span class="k">for</span> (<span class="k">const</span> q <span class="k">of</span> node.queues) result.add(q);
  <span class="k">if</span> (node.hash) visit(node.hash, idx);   <span class="c">// '#' can ALSO match zero remaining words</span>
  <span class="k">return</span>;
}</pre></div>`,
      cap:`When every word of the routing key has been consumed, any queue bound AT this exact node matches. The extra <code>visit(node.hash, idx)</code> call handles a subtle case: a binding like <code>stock.#</code> must match the bare key <code>stock</code> too — the <code>#</code> matching zero words.` },
    { stage:`<div class="codeblock" style="margin:0"><div class="cb-head"><span class="lang">js</span><span>literal and '*' — consume exactly one word</span></div><pre><span class="k">const</span> w = words[idx];
<span class="k">if</span> (node.children.has(w)) visit(node.children.get(w), idx + 1);
<span class="k">if</span> (node.star) visit(node.star, idx + 1);</pre></div>`,
      cap:`A literal child only continues if the exact word matches. A <code>*</code> child ALWAYS continues, consuming exactly one word regardless of what it is — both advance the index by exactly 1.` },
    { stage:`<div class="codeblock" style="margin:0"><div class="cb-head"><span class="lang">js</span><span>'#' — the backtracking</span></div><pre><span class="k">if</span> (node.hash) {
  <span class="c">// '#' matches ZERO OR MORE words: try every possible split point</span>
  <span class="k">for</span> (<span class="k">let</span> k = idx; k &lt;= words.length; k++) visit(node.hash, k);
}</pre></div>`,
      cap:`This is the genuine backtracking. Rather than greedily consuming everything, the matcher tries continuing past the <code>#</code> at EVERY possible position from here to the end of the key — 0 words consumed, 1 word, 2 words, and so on — because a <code>#</code> earlier in the pattern might need to leave words for a LATER literal or <code>*</code> to match against.` }
  ]);
})();
/* ============================================================
   7. QUEUE / ACK WIDGET (§11)
   ============================================================ */
(function(){
  const QK_CHANNEL = 900;
  let broker, msgN;
  function reset(){
    broker = MiniRMQ.createBroker();
    broker.declareExchange("demo-ex","direct");
    broker.declareQueue("demo-q");
    broker.bind("demo-ex","demo-q","k");
    msgN = 0;
  }
  function render(note){
    const qpid = broker.queuePids.get("demo-q");
    const qstate = broker.rt.actors.get(qpid).obj.state;
    const chpid = broker.channels.get(QK_CHANNEL);
    const chstate = chpid ? broker.rt.actors.get(chpid).obj.state : null;
    const consumer = qstate.consumers.get(QK_CHANNEL);
    let html = `<div class="qcard"><span class="qc-name">demo-q</span> — queued: ${qstate.messages.length}, consumer prefetch: ${consumer?consumer.prefetch:"(not consuming)"}, unacked: ${consumer?consumer.outstanding.length:0}</div>`;
    if (consumer && consumer.outstanding.length){
      html += `<div class="taglist">` + consumer.outstanding.map(m=>`<span class="tag unacked">tag ${m.deliveryTag}: "${new TextDecoder().decode(m.body)}"</span>`).join("") + `</div>`;
    }
    el("qk-state").innerHTML = html;
    if (note) el("qk-note").innerHTML = note;
  }
  el("qk-prefetch").oninput = ()=> el("qk-prefetch-val").textContent = el("qk-prefetch").value;
  el("qk-publish").onclick = ()=>{
    msgN++;
    broker.publish(700, "demo-ex", "k", "msg-" + msgN);
    render(`published msg-${msgN}. It's delivered immediately if the consumer has spare prefetch capacity, otherwise it waits.`);
  };
  el("qk-consume").onclick = ()=>{
    const prefetch = +el("qk-prefetch").value;
    broker.consume("demo-q", QK_CHANNEL, prefetch);
    render(`channel ${QK_CHANNEL} now consuming with prefetch=${prefetch} — up to that many messages can be unacked at once.`);
  };
  el("qk-ack").onclick = ()=>{
    const chpid = broker.channels.get(QK_CHANNEL);
    if (!chpid){ render(`consume first.`); return; }
    const tags = [...broker.rt.actors.get(chpid).obj.state.unacked.keys()];
    if (!tags.length){ render(`nothing unacked.`); return; }
    const tag = Math.min(...tags);
    const r = broker.ack(tag);
    render(`acked tag ${tag} — freed one prefetch slot, so the next queued message (if any) was immediately delivered.`);
  };
  el("qk-nack-requeue").onclick = ()=>{
    const chpid = broker.channels.get(QK_CHANNEL);
    if (!chpid){ render(`consume first.`); return; }
    const tags = [...broker.rt.actors.get(chpid).obj.state.unacked.keys()];
    if (!tags.length){ render(`nothing unacked.`); return; }
    const tag = Math.min(...tags);
    broker.nack(tag, true);
    render(`nacked tag ${tag} with requeue=true — pushed back to the FRONT of demo-q, redelivered on the next available slot.`);
  };
  el("qk-nack-drop").onclick = ()=>{
    const chpid = broker.channels.get(QK_CHANNEL);
    if (!chpid){ render(`consume first.`); return; }
    const tags = [...broker.rt.actors.get(chpid).obj.state.unacked.keys()];
    if (!tags.length){ render(`nothing unacked.`); return; }
    const tag = Math.min(...tags);
    broker.nack(tag, false);
    render(`nacked tag ${tag} with requeue=false — since demo-q has no DLX configured, it's dropped (see §12 for the DLX case).`);
  };
  el("qk-reset").onclick = ()=>{ reset(); render(`reset.`); };
  reset(); render();
})();

/* deck: attemptDeliver + CHANNEL_DOWN, annotated */
(function(){
  stepper("deckQueue", [
    { stage:`<div class="codeblock" style="margin:0"><div class="cb-head"><span class="lang">js</span><span>attemptDeliver() — prefetch is the gate</span></div><pre><span class="k">for</span> (<span class="k">const</span> [channelId, consumer] <span class="k">of</span> state.consumers) {
  <span class="k">while</span> (state.messages.length &amp;&amp; consumer.outstanding.length &lt; consumer.prefetch) {
    <span class="k">const</span> msg = state.messages.shift();
    <span class="k">const</span> tag = broker.nextDeliveryTag++;
    consumer.outstanding.push({ ...msg, deliveryTag: tag });
    broker.rt.send(channelPid, { type: <span class="s">"DELIVER"</span>, queue: name, message: delivered });
  }
}</pre></div>`,
      cap:`The while-condition IS prefetch: a consumer only ever receives more while its own <code>outstanding.length</code> is below its configured cap. Delivery tags are assigned here, by the QUEUE — but the tag→{queue,msgId} mapping is stored on the CHANNEL actor that receives the DELIVER message, not here.` },
    { stage:`<div class="codeblock" style="margin:0"><div class="cb-head"><span class="lang">js</span><span>ACK — free a slot, try again</span></div><pre><span class="k">if</span> (msg.type === <span class="s">"ACK"</span>) {
  <span class="k">const</span> c = state.consumers.get(msg.channelId);
  <span class="k">const</span> i = c.outstanding.findIndex(m => m.id === msg.msgId);
  <span class="k">if</span> (i &gt;= <span class="n">0</span>) c.outstanding.splice(i, <span class="n">1</span>);
  attemptDeliver();                     <span class="c">// a slot just freed up — try to fill it immediately</span>
}</pre></div>`,
      cap:`Acking doesn't just remove an entry — it immediately re-triggers delivery, which is exactly why acking one message can cause the NEXT queued message to appear the instant you click ack, with no separate poll needed.` },
    { stage:`<div class="codeblock" style="margin:0"><div class="cb-head"><span class="lang">js</span><span>CHANNEL_DOWN — requeue in original order</span></div><pre><span class="k">if</span> (msg.type === <span class="s">"CHANNEL_DOWN"</span>) {
  <span class="k">const</span> c = state.consumers.get(msg.channelId);
  <span class="k">for</span> (<span class="k">let</span> i = c.outstanding.length - <span class="n">1</span>; i &gt;= <span class="n">0</span>; i--)
    state.messages.unshift(c.outstanding[i]);   <span class="c">// front of the queue, original relative order preserved</span>
  state.consumers.delete(msg.channelId);
  attemptDeliver();                              <span class="c">// deliver to any OTHER consumer right away</span>
}</pre></div>`,
      cap:`Iterating backwards while unshifting is what preserves the original order at the front of the queue — the oldest of the dead channel's unacked messages ends up first in line again, exactly as chapter 5 promises for redelivery.` }
  ]);
})();
/* ============================================================
   8. CREDIT FLOW WIDGET (§12a)
   ============================================================ */
(function(){
  const CF_CHANNEL = 800;
  let broker, n;
  function reset(){
    broker = MiniRMQ.createBroker();
    broker.declareExchange("cf-ex","direct");
    broker.declareQueue("cf-q");
    broker.bind("cf-ex","cf-q","k");
    n = 0;
  }
  function render(note){
    const c = broker.creditFlow.credit("channel:" + CF_CHANNEL, "queue:cf-q");
    const pct = Math.max(0, Math.min(100, c / broker.creditFlow.initial * 100));
    el("cf-credit-num").textContent = c + " / " + broker.creditFlow.initial;
    const fill = el("cf-meter");
    fill.style.width = pct + "%";
    fill.className = "m-fill" + (pct <= 0 ? " hot" : pct <= 50 ? " warm" : "");
    if (note) el("cf-note").innerHTML = note;
  }
  el("cf-burst").onclick = ()=>{
    let blocked = 0;
    for (let i=0;i<5;i++){
      n++;
      const r = broker.publish(CF_CHANNEL, "cf-ex", "k", "flood-" + n, { drain:false });
      if (r.blocked) blocked++;
    }
    render(blocked
      ? `sent 5 without draining — <b style="color:var(--bad)">${blocked} of them were BLOCKED</b>: credit hit zero because nothing has processed the backlog yet. This is the real mechanism, not a fake meter.`
      : `sent 5 without draining the backlog (they sit unprocessed in cf-q's mailbox — credit only leaves, never returns, until something processes them).`);
  };
  el("cf-drain").onclick = ()=>{
    broker.rt.drain();
    render(`drained the backlog — the queue actor processed every pending ENQUEUE, calling <code>markProcessed()</code> for each, which replenishes credit in a batch once enough work has been reported done.`);
  };
  el("cf-reset").onclick = ()=>{ reset(); render(`reset.`); };
  reset(); render();
})();

/* deck: CreditFlow, annotated */
(function(){
  stepper("deckCredit", [
    { stage:`<div class="codeblock" style="margin:0"><div class="cb-head"><span class="lang">js</span><span>trySend() — spend one credit, or refuse</span></div><pre>trySend(from, to) {
  <span class="k">const</span> s = <span class="k">this</span>._get(from + <span class="s">"=>"</span> + to);
  <span class="k">if</span> (s.credit &lt;= <span class="n">0</span>) <span class="k">return</span> <span class="k">false</span>;   <span class="c">// caller must NOT send — this hop is blocked</span>
  s.credit--;
  <span class="k">return</span> <span class="k">true</span>;
}</pre></div>`,
      cap:`Called once per message, BEFORE the ENQUEUE is even sent to the queue actor's mailbox. If it returns false, <code>Broker.publish()</code> skips the send entirely — the message is refused right there, which is the "block the publisher" behavior, not a buffering delay.` },
    { stage:`<div class="codeblock" style="margin:0"><div class="cb-head"><span class="lang">js</span><span>markProcessed() — batch replenishment, not 1-for-1</span></div><pre>markProcessed(from, to) {
  <span class="k">const</span> s = <span class="k">this</span>._get(from + <span class="s">"=>"</span> + to);
  s.processed++;
  <span class="k">if</span> (s.processed &gt;= <span class="k">this</span>.replenishBatch) {   <span class="c">// e.g. every 10 messages actually handled</span>
    s.credit += s.processed;
    s.processed = <span class="n">0</span>;
  }
}</pre></div>`,
      cap:`Credit doesn't come back one-for-one as each message is processed — it comes back in a LUMP once a batch has genuinely been handled. Under smooth, fully-drained traffic this makes credit oscillate between roughly half and full, never truly blocking. It only races to zero when sends outpace processing — exactly the burst-without-draining scenario the widget demonstrates.` },
    { stage:`<div class="codeblock" style="margin:0"><div class="cb-head"><span class="lang">js</span><span>where it's called from Broker.publish()</span></div><pre><span class="k">const</span> ok = <span class="k">this</span>.creditFlow.trySend(<span class="s">"channel:"</span>+channelId, <span class="s">"queue:"</span>+qname);
<span class="k">if</span> (!ok) { <span class="c">/* mark blocked, do NOT send ENQUEUE */</span> <span class="k">continue</span>; }
<span class="k">this</span>.rt.send(qpid, { type: <span class="s">"ENQUEUE"</span>, fromChannel: channelId, message });</pre></div>`,
      cap:`This is the channel→queue hop specifically — upstream of delivery entirely, independent of consumer prefetch (§11). A queue can be credit-blocked from its PUBLISHER even while happily delivering its existing backlog to consumers; they are two different flow-control mechanisms solving two different problems.` }
  ]);
})();

/* ============================================================
   9. DEAD LETTER + TTL WIDGET (§12b)
   ============================================================ */
(function(){
  let broker, n;
  function reset(){
    broker = MiniRMQ.createBroker();
    broker.declareExchange("dl-ex","direct");
    broker.declareExchange("dl-dlx","fanout");
    broker.declareQueue("dl-deadq");
    broker.bind("dl-dlx","dl-deadq","");
    broker.declareQueue("dl-mainq", { ttl: 100, dlx: "dl-dlx" });
    broker.bind("dl-ex","dl-mainq","k");
    n = 0;
  }
  function render(note){
    const mainSt = broker.rt.actors.get(broker.queuePids.get("dl-mainq")).obj.state;
    const deadSt = broker.rt.actors.get(broker.queuePids.get("dl-deadq")).obj.state;
    let html = `<div class="qcard"><span class="qc-name">dl-mainq</span> (ttl=100ms) — depth: ${mainSt.messages.length}, clock: ${broker.now()}ms</div>`;
    html += `<div class="qcard"><span class="qc-name">dl-deadq</span> — depth: ${deadSt.messages.length}</div>`;
    if (deadSt.messages.length){
      html += deadSt.messages.map(m=>`<div class="frame"><span class="ff">"${new TextDecoder().decode(m.body)}"</span><span class="fl">x-death: ${JSON.stringify(m.xDeath)}</span></div>`).join("");
    }
    el("dl-view").innerHTML = html;
    if (note) el("dl-note").innerHTML = note;
  }
  el("dl-ms").oninput = ()=> el("dl-ms-val").textContent = el("dl-ms").value + " ms";
  el("dl-publish").onclick = ()=>{
    n++;
    broker.publish(600, "dl-ex", "k", "ttl-msg-" + n);
    render(`published ttl-msg-${n} at clock=${broker.now()}ms. It expires at clock ${broker.now()+100}ms — but ONLY once something checks the head (a publish, ack, nack, or an explicit clock advance).`);
  };
  el("dl-advance").onclick = ()=>{
    const ms = +el("dl-ms").value;
    broker.advanceClock(ms);
    render(`advanced the clock by ${ms}ms (now ${broker.now()}ms). If the HEAD message's age crossed 100ms, it was just dead-lettered into dl-deadq with an x-death entry.`);
  };
  el("dl-reset").onclick = ()=>{ reset(); render(`reset.`); };
  reset(); render();
})();

/* deck: deadLetter + checkExpiry, annotated */
(function(){
  stepper("deckDlx", [
    { stage:`<div class="codeblock" style="margin:0"><div class="cb-head"><span class="lang">js</span><span>checkExpiry() — head-of-queue only</span></div><pre><span class="k">function</span> <span class="f">checkExpiry</span>() {
  <span class="k">while</span> (state.messages.length &amp;&amp; state.ttl &gt; 0
      &amp;&amp; (broker.now() - state.messages[<span class="n">0</span>].insertedAt) &gt;= state.ttl) {
    <span class="k">const</span> dead = state.messages.shift();     <span class="c">// only ever looks at index 0</span>
    broker.deadLetter(name, dead, <span class="s">"expired"</span>);
  }
}</pre></div>`,
      cap:`This is not a scan of the whole queue — it's a while-loop over the FRONT only. A message with a short TTL sitting behind an older, longer-TTL head simply waits: this function will never even look at it until the head is gone. That's the real, documented RabbitMQ gotcha, reproduced exactly.` },
    { stage:`<div class="codeblock" style="margin:0"><div class="cb-head"><span class="lang">js</span><span>deadLetter() — build or merge the x-death entry</span></div><pre><span class="k">const</span> already = message.xDeath.find(d => d.queue===originalQueueName &amp;&amp; d.reason===reason);
<span class="k">let</span> xDeath = already
  ? message.xDeath.map(d => d===already ? {...d, count: d.count+1} : d)   <span class="c">// merge: bump count</span>
  : [...message.xDeath, { queue: originalQueueName, reason, "routing-keys":[...], count:1 }];</pre></div>`,
      cap:`The SAME queue+reason combination merges into one entry with an incrementing <code>count</code>, instead of appending a duplicate — exactly how a real consumer distinguishes "this looped through the same dead-letter path forty times" from forty separate unrelated hops.` },
    { stage:`<div class="codeblock" style="margin:0"><div class="cb-head"><span class="lang">js</span><span>routing the dead letter back through the SAME exchange layer</span></div><pre><span class="k">if</span> (qopts.dlx) {
  <span class="k">const</span> targets = <span class="k">this</span>.routeMessage(qopts.dlx, message.routingKey);   <span class="c">// same function as a normal publish!</span>
  <span class="k">for</span> (<span class="k">const</span> qn <span class="k">of</span> targets)
    <span class="k">this</span>.rt.send(<span class="k">this</span>.queuePids.get(qn), { type: <span class="s">"ENQUEUE"</span>, message: { ...message, xDeath } });
}</pre></div>`,
      cap:`Dead lettering isn't a separate delivery mechanism — it's an ordinary <code>routeMessage()</code> call against the queue's configured DLX, reusing §10's exchange layer completely unmodified. That's why a topic DLX with fancy routing "just works" for dead letters with zero extra code.` }
  ]);
})();
/* SCRIPT_CONTINUES_BELOW */
