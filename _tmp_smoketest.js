const assert = require("assert");
require("./_tmp_engine.js");
const MiniRMQ = globalThis.MiniRMQ;

let pass = 0, fail = 0;
function check(name, fn){
  try { fn(); pass++; console.log("PASS -", name); }
  catch(e){ fail++; console.log("FAIL -", name, "::", e.message); }
}

/* 1. frame codec round-trip + chunking at small frame_max */
check("frame codec: publish round-trips and chunks at small frame_max", () => {
  const body = new TextEncoder().encode("x".repeat(100)); // 100 bytes
  const frameMax = 32; // small -> forces multiple body frames (32-8=24B per chunk)
  const enc = MiniRMQ.encodePublish(1, "ex1", "some.key", body, { persistent: true }, frameMax);
  const dec = MiniRMQ.decodePublish(enc.bytes);
  assert.strictEqual(dec.exchange, "ex1");
  assert.strictEqual(dec.routingKey, "some.key");
  assert.strictEqual(dec.body.length, body.length);
  assert.deepStrictEqual([...dec.body], [...body]);
  assert.strictEqual(dec.properties.persistent, true);
  // expect ceil(100/24) = 5 body frames + 1 method + 1 header = 7 frames
  const expectedBodyFrames = Math.ceil(body.length / (frameMax - MiniRMQ.FRAME_OVERHEAD));
  assert.strictEqual(enc.frameCount, expectedBodyFrames + 2);
  assert.ok(enc.frameCount > 3, "expected genuine chunking into multiple body frames");
});

/* 2. topic routing trie */
check("topic trie: stock.usd.nyse matches exactly the first three bindings", () => {
  const trie = new MiniRMQ.TopicTrie();
  trie.bind("stock.#", "q1");
  trie.bind("*.usd.*", "q2");
  trie.bind("stock.*.nyse", "q3");
  trie.bind("stock.eur.#", "q4");
  const matched = trie.match("stock.usd.nyse");
  assert.deepStrictEqual([...matched].sort(), ["q1","q2","q3"]);
});

/* 3. fanout to 3 queues */
check("fanout exchange delivers to all 3 bound queues", () => {
  const b = MiniRMQ.createBroker();
  b.declareExchange("fan", "fanout");
  b.declareQueue("f1"); b.declareQueue("f2"); b.declareQueue("f3");
  b.bind("fan","f1",""); b.bind("fan","f2",""); b.bind("fan","f3","");
  const r = b.publish(0, "fan", "", "hello");
  assert.strictEqual(r.routed, 3);
  for (const q of ["f1","f2","f3"]){
    const pid = b.queuePids.get(q);
    const st = b.rt.actors.get(pid).obj.state;
    assert.strictEqual(st.messages.length, 1, q + " should have received the fanout message");
  }
});

/* 4. prefetch limiting */
check("prefetch=2 caps unacked outstanding until an ack arrives", () => {
  const b = MiniRMQ.createBroker();
  b.declareExchange("ex","direct");
  b.declareQueue("pq");
  b.bind("ex","pq","k");
  b.publish(1,"ex","k","m1"); b.publish(1,"ex","k","m2"); b.publish(1,"ex","k","m3");
  b.consume("pq", 10, 2);
  const qpid = b.queuePids.get("pq");
  const qstate = b.rt.actors.get(qpid).obj.state;
  const consumer = qstate.consumers.get(10);
  assert.strictEqual(consumer.outstanding.length, 2, "only 2 delivered, capped by prefetch");
  assert.strictEqual(qstate.messages.length, 1, "3rd message stays queued");
  // ack the first delivered message -> 3rd should now be delivered
  const chpid = b.channels.get(10);
  const chstate = b.rt.actors.get(chpid).obj.state;
  const firstTag = [...chstate.unacked.keys()][0];
  b.ack(firstTag);
  assert.strictEqual(consumer.outstanding.length, 2, "still capped at 2 after redelivery of the 3rd");
  assert.strictEqual(qstate.messages.length, 0, "queue drained the 3rd message after credit freed up");
});

/* 5. channel death requeues unacked messages, then redelivered to a new consumer */
check("killing a channel requeues its unacked messages for redelivery", () => {
  const b = MiniRMQ.createBroker();
  b.declareExchange("ex","direct");
  b.declareQueue("rq");
  b.bind("ex","rq","k");
  b.publish(1,"ex","k","alpha");
  b.publish(1,"ex","k","beta");
  b.consume("rq", 20, 5);
  const qpid = b.queuePids.get("rq");
  const qstate = b.rt.actors.get(qpid).obj.state;
  assert.strictEqual(qstate.consumers.get(20).outstanding.length, 2, "both delivered, unacked");
  b.killChannel(20);
  assert.strictEqual(qstate.messages.length, 2, "both messages requeued after channel death");
  assert.ok(!qstate.consumers.has(20), "dead channel's consumer registration removed");
  b.consume("rq", 21, 5);
  const consumer21 = qstate.consumers.get(21);
  assert.strictEqual(consumer21.outstanding.length, 2, "redelivered to the new consumer");
  const bodies = consumer21.outstanding.map(m => new TextDecoder().decode(m.body)).sort();
  assert.deepStrictEqual(bodies, ["alpha","beta"]);
});

/* 6. nack requeue=false with DLX -> dead letter queue gets x-death header */
check("nack without requeue on a DLX-configured queue dead-letters with x-death", () => {
  const b = MiniRMQ.createBroker();
  b.declareExchange("main-ex","direct");
  b.declareExchange("dlx-ex","fanout");
  b.declareQueue("deadq");
  b.bind("dlx-ex","deadq","");
  b.declareQueue("mainq", { dlx: "dlx-ex" });
  b.bind("main-ex","mainq","k");
  b.publish(1,"main-ex","k","poison");
  b.consume("mainq", 30, 1);
  const chpid = b.channels.get(30);
  const chstate = b.rt.actors.get(chpid).obj.state;
  const tag = [...chstate.unacked.keys()][0];
  b.nack(tag, false);
  const deadqPid = b.queuePids.get("deadq");
  const deadqState = b.rt.actors.get(deadqPid).obj.state;
  assert.strictEqual(deadqState.messages.length, 1, "poison message arrived at the dead-letter queue");
  const deadMsg = deadqState.messages[0];
  assert.strictEqual(deadMsg.xDeath.length, 1);
  assert.strictEqual(deadMsg.xDeath[0].queue, "mainq");
  assert.strictEqual(deadMsg.xDeath[0].reason, "rejected");
  assert.strictEqual(new TextDecoder().decode(deadMsg.body), "poison");
});

/* 7. credit depletion blocks the upstream publisher */
check("depleting queue-hop credit blocks further publishes from that channel", () => {
  const b = MiniRMQ.createBroker();
  b.declareExchange("ex","direct");
  b.declareQueue("cq");
  b.bind("ex","cq","k");
  const initial = b.creditFlow.initial; // 20
  for (let i = 0; i < initial; i++){
    const r = b.publish(5, "ex", "k", "m" + i, { drain: false }); // never drained -> queue never processes -> credit never replenished
    assert.strictEqual(r.blocked, false, "publish " + i + " should still have credit");
  }
  const blockedResult = b.publish(5, "ex", "k", "one-too-many", { drain: false });
  assert.strictEqual(blockedResult.blocked, true, "credit should now be exhausted and the publish blocked");
  assert.strictEqual(blockedResult.routed, 1, "routing still resolves the target queue even though delivery is blocked");
  // now drain the backlog: the queue actor processes the backed-up ENQUEUEs and credit replenishes
  b.rt.drain();
  const unblocked = b.publish(5, "ex", "k", "after-drain");
  assert.strictEqual(unblocked.blocked, false, "credit replenished after the queue caught up");
});

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
