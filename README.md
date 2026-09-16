# CWI Trust Fabric

**A cryptographic transparency log for Cumulative Web Inc.** Every public claim
the company makes lands here as a signed, hash-chained envelope — real
Ed25519 signatures, real SHA-256 chain, verifiable by anyone with zero trust
in us. Cost to build: $0.

- 🌐 **Live log:** https://cumulativewebinc.github.io/cwi-trust-log/
- 🏆 **Achievements feed:** https://cumulativewebinc.github.io/cwi-trust-log/achievements.html
- 📜 **Protocol spec:** [TRUST-PROTOCOL.md](TRUST-PROTOCOL.md)
- 🔑 **Public key:** [keys/ed25519.pub](keys/ed25519.pub)

## Verify a claim in 3 steps

You don't have to trust us. You just have to run this:

```bash
node verify.js https://cumulativewebinc.github.io/cwi-trust-log/claims/<claim_id>.json
```

`verify.js` is zero-dependency Node. It:

1. Fetches the public key (or takes `--pubkey`) and checks the **Ed25519
   signature** over the canonical payload bytes.
2. Recomputes the claim's **SHA-256 hash** and walks the **hash chain** back to
   `GENESIS` using the public `claims/index.json`.
3. Prints `PASS`/`FAIL` per check and exits `0`/`1`.

```
$ node verify.js https://cumulativewebinc.github.io/cwi-trust-log/claims/clm_01M2N4M1NB3D6V7JREVW7GNF8J.json
signature: PASS  (Ed25519, key keys/ed25519.pub)
chain:     PASS  (hash matches, prev_hash links to index)
chain tip: PASS  (index tip f9bd455b…7f56479a)
RESULT: PASS
```

## Repo layout

```
claims/<claim_id>.json   signed claim envelopes (byte-identical to issuance)
claims/<claim_id>.html   human-readable claim pages
claims/index.json        hash chain: ordered hashes, prev links, tip
keys/ed25519.pub         signing public key (+ keys/README.md provenance)
achievements.json        "bring back achievements" feed, machine-readable
achievements.html        same feed, human-readable, newest first
verify.js                zero-dep Node verifier (file or URL)
test/test.js             zero-dep Node test suite (node test/test.js)
TRUST-PROTOCOL.md        spec trust/1.0
CHANGELOG.md             spec change history
```

## Rules

- **No receipt → never VERIFIED.** A claim only earns the VERIFIED tier when
  evidence was observed and recorded at issuance time.
- Old envelopes stay valid forever. Protocol upgrades never rewrite history.
- The private key is never in this repo. Nothing here can sign — only verify.
