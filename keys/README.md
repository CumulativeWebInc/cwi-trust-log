# CWI Trust Fabric — signing key

## Public key

`keys/ed25519.pub` is the **public half of the Ed25519 keypair** that signs every
claim envelope in this log.

```
-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEArd7O+OjGWkPPCJ6eYUzACT8VWGGRjHrJoZ1tS8+2cgU=
-----END PUBLIC KEY-----
```

## Provenance

- This is the **same key** published at
  https://cumulativewebinc.github.io/gear-ledger/keys/ed25519.pub
  (the Gear Ledger signing key). The two files carry identical bytes.
- It is copied here for **self-containment**: an independent verifier should be
  able to verify this entire log using only this repository, with zero trust
  in Cumulative Web Inc beyond the fact that this key is the one we say it is.
- **Cross-checks are encouraged.** If the bytes here ever differ from the
  gear-ledger copy, treat the log as suspect and verify the provenance chain
  before trusting any claim.

## The private key is never here

The private half lives on Black's signing workstation only
(`~/.config/gear-ledger/ed25519.key`, 600 perms). It is never committed,
never transmitted, never read by any tool in this repository. `verify.js`
needs only this public key.
