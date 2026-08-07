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