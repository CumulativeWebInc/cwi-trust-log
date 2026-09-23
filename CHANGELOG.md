# CHANGELOG
## 2026-09-23 — v2026.09.23 — trust infra (A7/A8)
- **A7 PR preview bot:** `.github/workflows/pr-preview.yml` builds each PR branch, deploys a live preview to `pr-previews/<PR#>/`, and posts the preview link + contract validation checklist as a PR comment (Vercel pattern).
- **A8/A9 contract CI gate:** the build now fails if `.well-known/agent-card.json` is missing or invalid (name/url required), if the `SCHEMA-VERSIONS.json` contract breaks (where the registry exists), if `content.json` is invalid, or if `CHANGELOG.md` is missing.

## 2026-09-18 — chain extended to 11 VERIFIED

Friday scorecard run (Results dept): confirmed wins that had no envelopes now do.

- New envelopes: `app:cwi-kingcode-lens` (KingCode Lens v1.0.0 — tag published 2026-09-18T12:38:01Z, live demo HTTP 200, 117/117 tests), `app:cwi-memory-chain` (Memory Chain iOS PWA live, MUSE_CWI + CWI_Data L1 anchors present, first anchor→verify→tamper-drill loop passed), `placement:playlist-holds-2026-09-18` (fresh 2026-09-18 scan: Shaka Zulu #21 / Zooted Zone #30 / Doves & Diamonds #31 on New Rap Hits; Zooted Zone #21/21 on No Label Needed — all holding).
- Previous 8 envelopes re-issued with fresh ULIDs and new chain hashes (same statements); old claim IDs superseded and removed from the repo.
- Tip hash: `e6ed72e06b6ce45bd025da3a3c09a9be5331046c8a85e7edbc3ab7370fb61159`
- Tooling fix: `generate.js` index.html section assigned to a `const` — never ran; fixed (`let idxBody`), index.html now regenerates with every batch.

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
