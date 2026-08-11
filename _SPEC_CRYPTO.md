# SPEC — Applied Cryptography Internals (crypto-01…16)

## Your chapter's brief lives in `data/site.js`
Find your chapter id in the `COURSES` array (key `"crypto"`). Its `title`, `desc`, `tags`, and `sim`
fields are the authoritative brief — `desc` lists the topics you must cover, `sim` describes the
flagship simulator. Expand that brief into a full chapter; do not narrow it.

## Reference implementation
`pg-01.html` is the CANONICAL TEMPLATE — read it in full. Copy its entire `<style>` block, its `<head>`
favicon/theme-color links, `#topbar`, `#toc`, `#readbar`, hero block, `.lesson-end`, and its JS helpers
(`el`, `stepper`, `qaCards`, the `QUIZ` array + renderer, the order-quiz, and the closing chrome block).

Accent — change ONLY these two CSS variables:
- `--pg:#ec4899;` and `--pg-dim:rgba(236,72,153,.12);` — pink/magenta, hero gradient pink→rose.

Topbar crumb: `APPLIED CRYPTOGRAPHY · <b>CH 0N / 16</b> · <SHORT NAME>`
Topbar back link: `course-crypto.html` with course name "Applied Cryptography Internals".

⚠ **Write all prose and all simulator JS fresh.** Sibling chapters have failed review for leaving another
course's content or JS behind. Every `el("...")` in your file must match a real `id=` in that same file, and
the file must contain zero PostgreSQL/Kafka/RabbitMQ/blockchain/Bitcoin/container terms except in a
deliberate comparison sentence.

## Relationship to the Blockchain/Bitcoin courses already on this site
Those two courses already cover SHA-256, Merkle trees, secp256k1/ECDSA, and Schnorr/BIP340 in depth as
blockchain-specific primitives. This course does NOT re-teach those from a blockchain angle — it covers
the primitives blockchain didn't: symmetric ciphers (AES, ChaCha20), block cipher modes, MACs and AEAD,
key derivation, RSA, TLS, PKI/certificates, and the real-world vulnerability classes (padding oracles,
length extension, weak randomness) that come from getting these wrong. Where a concept genuinely overlaps
(e.g. elliptic curve math, HMAC), a brief cross-reference sentence to the Blockchain course is fine; do not
re-derive the curve arithmetic from scratch — assume the reader may not have taken that course and give
enough grounding to stand alone, but keep the depth budget on what's unique to this course.

## Audience
Senior → Staff/Principal engineers. Assume strong systems background, no prior applied-crypto specialization.
Teach **mechanism**, not "just use a library" hand-waving — though the chapters should still end with the
practical, current recommendation (e.g. "use AES-GCM or ChaCha20-Poly1305 via a vetted library; here is
exactly why, and here is what goes wrong if you don't"). Never say "AES is secure" without qualification —
say what security property holds under what threat model. No cryptocurrency price talk, no vendor
boosterism for any specific TLS library or cloud KMS.

Be precise with numbers and cite real artifacts: RFC numbers (RFC 8439 ChaCha20-Poly1305, RFC 5869 HKDF,
RFC 8446 TLS 1.3), CVE ids (CVE-2014-0160 Heartbleed, CVE-2017-15361 ROCA, CVE-2008-0166 Debian OpenSSL),
NIST publication numbers (FIPS 197 AES, SP 800-38D GCM, SP 800-63B for KDF/password guidance), real
attack names (BEAST, POODLE, Lucky13, Bleichenbacher '98/'06, DROWN, Logjam), and real constants where
they matter (AES has 10/12/14 rounds for 128/192/256-bit keys; GCM's authentication tag is typically 128
bits; RSA's public exponent is conventionally 65537).

## Mandatory structure — 16 `<section>` elements, ids `s1`..`s16`
1. `s1` THE PROBLEM  2. `s2` HISTORICAL CONTEXT (**interactive timeline widget**)
3. `s3` NAIVE SOLUTION (code block strawman)  4. `s4` WHY IT FAILS (quantified, with math)
5. `s5` BETTER SOLUTION (**stepper deck**)  6. `s6` WHY THAT STILL FAILS / COSTS
7. `s7` FINAL ARCHITECTURE (**interactive explorer widget**)
8. `s8` INTERNAL IMPLEMENTATION — the core: real byte layouts, round functions, field arithmetic,
   protocol state machines. At least one **stepper deck** and one **slider-driven widget**.
9. `s9` TRADEOFFS — `table.cmp` comparing alternatives honestly
10. `s10` PERFORMANCE / SECURITY CHARACTERISTICS — complexity, attack cost in real operations, a
    **canvas chart**
11. `s11` REAL-WORLD INCIDENTS — named CVEs/events with root-cause analysis
12. `s12` INTERVIEW QUESTIONS — 6-7 `qaCards()`, SENIOR/STAFF/PRINCIPAL
13. `s13` CODE WALKTHROUGH — `.ftree` module tree + 2-4 annotated `.codeblock`s (real OpenSSL/BoringSSL/
    libsodium source shape, or precise reference pseudocode), plus a "why it was built this way" callout
14. `s14` QUIZ — 6 multiple-choice (each wrong answer explained) + one ordering challenge
15. `s15` SIMULATOR — the flagship interactive simulation from your `sim` field
16. `s16` KNOWLEDGE CHECK — 3 `qaCards()` "THINK" questions forward-referencing the next chapter (the
    final chapter, crypto-16, should instead ask reflective/synthesis questions about the whole course)

## Interactivity
Minimum: 1 clickable timeline, 2+ stepper decks, 1 explorer, 2+ slider widgets, 1 canvas animation/chart,
quiz + order quiz, 1 substantial simulator. Prefer `<canvas>`/SVG for anything that moves;
requestAnimationFrame; 60fps. AES round transformations, cipher-mode chaining, length-extension attacks,
padding-oracle byte recovery, and the TLS handshake are all excellent candidates for animation.

**Where you show cryptographic computation, make it real.** Implement AES, ChaCha20, SHA-256/HMAC, HKDF,
or modular/RSA arithmetic in JS (BigInt is available) so the simulator computes genuine values and can be
checked against known test vectors (FIPS 197 Appendix B/C for AES, RFC 7539/8439 for ChaCha20-Poly1305,
RFC 5869 for HKDF, RFC 8017 for RSA/PKCS#1) rather than fake-looking hex.

## Hard rules
- Single self-contained HTML file. No frameworks, no CDN, no images, no localStorage except the progress key.
- Dark mode only. `.lesson-end` `#mark-done` writes `p["<chapter-id>"] = true` into `sysinternals-progress-v1`.
- Next-chapter button links to the next file. Final chapter (crypto-16) links back to `index.html`
  reading "← Course complete · Back to hub".
- **Verify before finishing**: extract the `<script>`, run `node --check` via bash; confirm exactly 16
  sections, >100 KB, file ends with `</html>`, every `el("...")` resolves, zero cross-course contamination.

## Tone
Confident, precise, first-principles. Derive, don't assert. Flowing prose in `<p>` paragraphs with
occasional `ul.plain` lists — not bullet soup.
