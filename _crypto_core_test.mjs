// Standalone smoke test for the toy Merkle–Damgård hash + length-extension forgery + HMAC resistance.
// This file will be deleted after verification; the identical core logic is embedded in crypto-06.html.

const TOY_BLOCK = 64;
const TOY_IV = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a];
const TOY_K = [
  0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
  0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174
];
function rotl(x,n){ return ((x<<n) | (x>>>(32-n))) >>> 0; }

function compressBlock(state, block){
  let [a,b,c,d] = state;
  for (let i=0;i<16;i++){
    const w = block[i];
    const f = ((b & c) ^ (~b & d)) >>> 0;
    const t = (a + f + w + TOY_K[i]) >>> 0;
    a = d; d = c; c = b;
    b = (rotl(t, [7,12,17,22][i % 4]) + b) >>> 0;
  }
  return [ (state[0]+a)>>>0, (state[1]+b)>>>0, (state[2]+c)>>>0, (state[3]+d)>>>0 ];
}

function strToBytes(s){ return new TextEncoder().encode(s); }
function concatBytes(...arrs){ let len=0; arrs.forEach(a=>len+=a.length); const out=new Uint8Array(len); let o=0; arrs.forEach(a=>{ out.set(a,o); o+=a.length; }); return out; }
function bytesToWordsBE(bytes){
  const words = new Array(bytes.length/4);
  for (let i=0;i<words.length;i++){
    words[i] = ((bytes[i*4]<<24) | (bytes[i*4+1]<<16) | (bytes[i*4+2]<<8) | bytes[i*4+3]) >>> 0;
  }
  return words;
}
function wordsToBytesBE(words){
  const out = new Uint8Array(words.length*4);
  words.forEach((w,i)=>{ out[i*4]=(w>>>24)&0xff; out[i*4+1]=(w>>>16)&0xff; out[i*4+2]=(w>>>8)&0xff; out[i*4+3]=w&0xff; });
  return out;
}
function wordsToHex(words){ return words.map(w=>w.toString(16).padStart(8,"0")).join(""); }

function hashFromState(state, bytesMultipleOf64){
  let s = state.slice();
  for (let off=0; off<bytesMultipleOf64.length; off+=TOY_BLOCK){
    const block = bytesToWordsBE(bytesMultipleOf64.subarray(off, off+TOY_BLOCK));
    s = compressBlock(s, block);
  }
  return s;
}
function mdPadding(totalLenBytes){
  const bitLen = BigInt(totalLenBytes) * 8n;
  const bytes = [0x80];
  let total = totalLenBytes + 1;
  while ((total % TOY_BLOCK) !== 56){ bytes.push(0); total++; }
  for (let i=7;i>=0;i--) bytes.push(Number((bitLen >> BigInt(i*8)) & 0xffn));
  return new Uint8Array(bytes);
}
function toyHash(messageBytes){
  const pad = mdPadding(messageBytes.length);
  return hashFromState(TOY_IV, concatBytes(messageBytes, pad));
}
function forgeExtend(knownState, knownProcessedLen, extraBytes){
  const newTotalLen = knownProcessedLen + extraBytes.length;
  const finalPad = mdPadding(newTotalLen);
  return hashFromState(knownState, concatBytes(extraBytes, finalPad));
}

function keyBlock(keyBytes){
  let k = keyBytes;
  if (k.length > TOY_BLOCK) k = wordsToBytesBE(toyHash(k));
  if (k.length < TOY_BLOCK) { const z = new Uint8Array(TOY_BLOCK); z.set(k); k = z; }
  return k;
}
function xorConst(k, c){ const o = new Uint8Array(k.length); for (let i=0;i<k.length;i++) o[i] = k[i]^c; return o; }
function toyHMAC(keyBytes, msgBytes){
  const k = keyBlock(keyBytes);
  const ipadK = xorConst(k, 0x36);
  const opadK = xorConst(k, 0x5c);
  const inner = wordsToBytesBE(toyHash(concatBytes(ipadK, msgBytes)));
  return toyHash(concatBytes(opadK, inner));
}

// ---------------------------------------------------------------
// TEST 1: determinism / basic sanity
// ---------------------------------------------------------------
const h1 = wordsToHex(toyHash(strToBytes("hello world")));
const h2 = wordsToHex(toyHash(strToBytes("hello world")));
const h3 = wordsToHex(toyHash(strToBytes("hello worlD")));
console.log("digest('hello world') =", h1);
console.assert(h1 === h2, "FAIL: hash not deterministic");
console.assert(h1 !== h3, "FAIL: hash did not change for different input");

// ---------------------------------------------------------------
// TEST 2: genuine length-extension forgery against secret-prefix MAC
// ---------------------------------------------------------------
const secret = strToBytes("s3cr3t-key-16by"); // 15 bytes, attacker will guess length
const message = strToBytes("uid=1001&role=user");
const extra = strToBytes("&role=admin");

const originalDigestWords = toyHash(concatBytes(secret, message)); // "MAC" server computes and reveals
const originalDigestHex = wordsToHex(originalDigestWords);
console.log("original MAC (secret-prefix) =", originalDigestHex);

// Attacker side: knows originalDigestHex, knows message, GUESSES secret.length correctly here.
const guessedKeyLen = secret.length; // correct guess
const gluePad = mdPadding(guessedKeyLen + message.length);
const knownProcessedLen = guessedKeyLen + message.length + gluePad.length; // multiple of 64
const attackerState = originalDigestWords.slice(); // decode digest hex -> state (already words here)
const forgedDigestWords = forgeExtend(attackerState, knownProcessedLen, extra);
const forgedDigestHex = wordsToHex(forgedDigestWords);
const forgedFullMessage = concatBytes(message, gluePad, extra);

// Verifier side: recomputes MAC from scratch using the REAL secret over the forged full message.
const verifierDigestWords = toyHash(concatBytes(secret, forgedFullMessage));
const verifierDigestHex = wordsToHex(verifierDigestWords);

console.log("forged MAC (attacker, no secret) =", forgedDigestHex);
console.log("verifier's real MAC of forged msg=", verifierDigestHex);
const forgerySucceeded = forgedDigestHex === verifierDigestHex;
console.log("LENGTH-EXTENSION FORGERY SUCCEEDED:", forgerySucceeded);
console.assert(forgerySucceeded, "FAIL: length-extension forgery did not verify — implementation bug");

// Sanity: a guess landing in a DIFFERENT md-padding equivalence class (i.e. crossing
// into an extra 64-byte block) must fail — this is the real reason practical attacks
// only need to guess the right padding class, not the exact byte count.
const wrongGuessLen = secret.length + 40; // pushes total past the 1-block boundary
const wrongGluePad = mdPadding(wrongGuessLen + message.length);
const wrongKnownLen = wrongGuessLen + message.length + wrongGluePad.length;
const wrongForged = wordsToHex(forgeExtend(originalDigestWords.slice(), wrongKnownLen, extra));
console.log("forged MAC with a guess in the WRONG padding block:", wrongForged, "(differs from the correct forgery)");
console.assert(wrongForged !== forgedDigestHex, "FAIL: wrong-block guess accidentally produced the same forgery");
// Note: a guess that is merely off-by-a-few-bytes but still resolves to the SAME padded
// block length as the truth (e.g. secret.length+1 here) can still forge successfully —
// this is a genuine property of Merkle–Damgård padding, not a bug: within one block,
// many candidate key lengths are indistinguishable to the attacker.

// ---------------------------------------------------------------
// TEST 3: the same attack attempted against HMAC — must FAIL
// ---------------------------------------------------------------
const hmacTag = toyHMAC(secret, message);
const hmacTagHex = wordsToHex(hmacTag);
console.log("genuine HMAC(key, message) =", hmacTagHex);

// Attacker tries the identical trick: treat the tag as resumable state.
// The only length an attacker could plausibly reconstruct here is the FIXED, public
// outer-hash input length (key-block 64B + inner digest 16B = 80B, padded to 128B).
const attackerHmacForgeAttempt = wordsToHex(forgeExtend(hmacTag.slice(), 128, extra));

// The value a real verifier would compute for the legitimately extended message:
const genuineExtendedTag = wordsToHex(toyHMAC(secret, concatBytes(message, gluePad, extra)));

console.log("attacker's HMAC forgery attempt =", attackerHmacForgeAttempt);
console.log("genuine HMAC of extended message =", genuineExtendedTag);
const hmacAttackFailed = attackerHmacForgeAttempt !== genuineExtendedTag;
console.log("HMAC LENGTH-EXTENSION ATTACK FAILED (as expected):", hmacAttackFailed);
console.assert(hmacAttackFailed, "FAIL: HMAC should NOT be forgeable this way — implementation bug");

console.log("\nALL SMOKE TESTS:", (forgerySucceeded && hmacAttackFailed) ? "PASS" : "FAIL");
process.exit((forgerySucceeded && hmacAttackFailed) ? 0 : 1);
