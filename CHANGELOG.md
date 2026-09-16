# CHANGELOG

## v1.0 — 2026-09-16

Initial release of the CWI Trust Fabric protocol (`trust/1.0`).

- Signed claim envelope schema with 10 required fields.
- Canonicalization: recursive key sort, no whitespace, UTF-8.
- Ed25519 signatures over canonical payload bytes (base64).
- SHA-256 hash chain over canonical full envelopes, genesis `prev_hash: "GENESIS"`.
- `claims/index.json` chain index with `tip_hash`.
- Tier vocabulary: `VERIFIED` / `UNVERIFIED` / `UNCONFIRMED` / `SAMPLE`,
  with the hard rule "no receipt → never VERIFIED".
- Issuer fixed as "Cumulative Web Inc".
- Zero-dependency Node verifier (`verify.js`) and test suite (`test/test.js`).
- Genesis chain: 8 VERIFIED claims (2 shipped apps, catalog expansion,
  4 playlist placements, 1 dataset release).
  Tip hash: `f9bd455b78b37308420e7b337d72f9e954397f6e39c95c7ac3016fa19f56479a`
