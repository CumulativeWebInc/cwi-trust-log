# CWI Trust Fabric — Protocol Specification

**Spec version:** `trust/1.0`
**Effective:** 2026-09-16
**Issuer:** Cumulative Web Inc

## 1. Purpose

The CWI Trust Fabric is a public transparency log. Every material claim the
company makes — products shipped, catalog facts, playlist placements, dataset
releases — is published as a signed claim envelope. Anyone with an internet
connection and a Node runtime can verify any claim without trusting CWI.

Design goals:

- **Real cryptography.** Ed25519 signatures over canonical payload bytes.
  No mock data, no placeholders.
- **Real chain.** SHA-256 hash chain with explicit genesis; any insertion,
  deletion, or reorder breaks verification.
- **Zero trust required.** Verification needs only public data: the envelope,
  the chain index, and the public key — all served from this repository.
- **$0 to run.** Static hosting (GitHub Pages), zero-dependency verifier.

## 2. Envelope schema

A claim envelope is a JSON object with exactly these fields:

| Field       | Type   | Required | Description                                  |
|-------------|--------|----------|----------------------------------------------|
| `protocol`  | string | yes      | Spec version, e.g. `"trust/1.0"`             |
| `claim_id`  | string | yes      | Unique id: `"clm_"` + 26-char ULID (Crockford base32) |
| `subject`   | string | yes      | Namespaced subject, e.g. `"app:cwi-sync-audition"` |
| `statement` | string | yes      | The plain-language claim being asserted      |
| `evidence`  | object | yes      | `{ method, observed_at, source_url, raw_ref }` |
| `tier`      | string | yes      | One of the §5 tier vocabulary values         |
| `issuer`    | string | yes      | `"Cumulative Web Inc"`                       |
| `issued_at` | string | yes      | ISO-8601 UTC timestamp                       |
| `prev_hash` | string | yes      | SHA-256 hex of the previous envelope, or `"GENESIS"` |
| `signature` | object | yes      | `{ alg: "Ed25519", sig: <base64> }`          |

`evidence.raw_ref` is free-form: the raw observation (commit SHA, scan
position, test counts) that would let a third party reproduce the check.

## 3. Canonicalization

Signature and hash inputs are produced by one deterministic function:

- **Recursive key sort:** object keys are sorted lexicographically at every
  depth. Array order is preserved.
- **No whitespace:** compact JSON — no spaces, no newlines, no indentation.
- **Encoding:** UTF-8 bytes of the canonical JSON string.

Reference implementation (Node, no dependencies):

```js
function canon(v) {
  if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
  if (v && typeof v === 'object')
    return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}';
  return JSON.stringify(v);
}
```

## 4. Signature

- The signed payload is the envelope **without** the `signature` field.
- Algorithm: **Ed25519**, applied directly to the canonical payload bytes
  (pure Ed25519 — no prehash).
- `signature.sig` is the raw 64-byte signature, base64-encoded.

## 5. Hash chain

- `claim_hash = sha256_hex(canon(envelope))` — canonical form of the
  **complete envelope including `signature`**.
- The first claim in the log sets `prev_hash: "GENESIS"`.
- `claims/index.json` records, in issuance order, each `claim_id`,
  `claim_hash`, `prev_hash`, `tier`, `subject`, and `issued_at`, plus
  `tip_hash` (the latest claim hash) and `genesis_prev_hash: "GENESIS"`.
- **Integrity rule:** deleting, inserting, reordering, or editing any envelope
  invalidates every downstream hash. The tip hash is the single value an
  external observer needs to pin the log's state.

## 6. Tier vocabulary

| Tier          | Meaning |
|---------------|---------|
| `VERIFIED`    | Evidence was observed and recorded at issuance time (receipt exists). |
| `UNVERIFIED`  | Checked, but the evidence did not confirm the claim. |
| `UNCONFIRMED` | Claimed by a third party; CWI has not independently confirmed it. |
| `SAMPLE`      | Illustrative / example claim, not an assertion of fact. |

**Hard rule: no receipt → never VERIFIED.** A claim may not be issued (or
upgraded to) `VERIFIED` unless the `evidence.raw_ref` recorded at issuance
contains the actual observed artifacts (shas, scan results, test counts).
Third-party assertions (curator promises, hearsay) can never be VERIFIED —
they are `UNCONFIRMED` at best until independently observed.

## 7. Issuer

All envelopes in this log are issued by **Cumulative Web Inc**. The `issuer`
field is fixed; a claim issued by anyone else belongs in a different log.

## 8. Verification procedure

Given an envelope, a chain index, and the public key:

1. **Schema check** — required fields present, tier in vocabulary,
   `protocol` a known version, `signature.alg === "Ed25519"`.
2. **Signature check** — strip `signature`, canonicalize the payload (§3),
   verify Ed25519 against the public key (§4).
3. **Chain check** — recompute `sha256_hex(canon(envelope))` and compare to
   the index entry's `claim_hash`; confirm the `prev_hash` links form an
   unbroken chain back to `"GENESIS"`; confirm the final hash equals the
   index's `tip_hash`.

Any failure → the claim is not trusted. The reference implementation is
`verify.js` in this repository (zero dependencies, works on files or URLs).

## 9. EVOLUTION — how the protocol changes

- Every envelope carries its `protocol` version. **Old envelopes stay valid
  forever** under the version that issued them; a protocol upgrade never
  rewrites history.
- Spec changes are reviewed **quarterly**, tied to the CWI teach cycle.
  Current review cycle: **2026-Q3**.
- Every spec change is recorded in `CHANGELOG.md` with its date and a
  migration note. A version bump is required for any change to
  canonicalization, the signature algorithm, the schema's required fields, or
  the tier vocabulary. Clarifications and non-breaking additions may ship as
  patch notes without a version bump.
- Verifiers SHOULD pin `trust/1.0` behavior for 1.0 envelopes and MUST NOT
  reject an envelope solely because a newer spec version exists.
