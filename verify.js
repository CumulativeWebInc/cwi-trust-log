#!/usr/bin/env node
/**
 * CWI Trust Fabric — verify.js (spec trust/1.0)
 *
 * Verifies a signed claim envelope with zero trust in CWI, using only
 * public data. Zero dependencies; Node 18+.
 *
 *   node verify.js <envelope.json|URL> [--chain <index.json|URL>] [--pubkey <file|URL>]
 *
 * Checks:
 *   1. schema      — required fields, tier vocabulary, protocol, alg
 *   2. signature   — Ed25519 over canonical payload bytes
 *   3. chain       — hash recompute + prev_hash linkage + tip (if --chain)
 *
 * Exit 0 on PASS, 1 on any FAIL.
 */
import { readFileSync } from 'node:fs';
import { createHash, createPublicKey, verify } from 'node:crypto';

const TIERS = new Set(['VERIFIED', 'UNVERIFIED', 'UNCONFIRMED', 'SAMPLE']);
const REQUIRED = ['protocol', 'claim_id', 'subject', 'statement', 'evidence', 'tier',
  'issuer', 'issued_at', 'prev_hash', 'signature'];
const GENESIS = 'GENESIS';

// ---- canonical JSON: recursive key sort, no whitespace ----
function canon(v) {
  if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
  if (v && typeof v === 'object') {
    return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}';
  }
  return JSON.stringify(v);
}
const sha256hex = (s) => createHash('sha256').update(s, 'utf8').digest('hex');

async function loadInput(src) {
  if (/^https?:\/\//.test(src)) {
    const res = await fetch(src);
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${src}`);
    return await res.text();
  }
  return readFileSync(src, 'utf8');
}

function parseArgs(argv) {
  const a = { envelope: null, chain: null, pubkey: null };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--chain') a.chain = argv[++i];
    else if (argv[i] === '--pubkey') a.pubkey = argv[++i];
    else rest.push(argv[i]);
  }
  a.envelope = rest[0] || null;
  return a;
}

function defaultChainUrl(envelopeSrc) {
  // If the envelope came from the trust-log claims/ path, derive the index URL.
  const m = /^(.+)\/claims\/[^/]+\.json$/.exec(envelopeSrc);
  return m ? `${m[1]}/claims/index.json` : null;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.envelope) {
    console.error('Usage: node verify.js <envelope.json|URL> [--chain <index.json|URL>] [--pubkey <file|URL>]');
    process.exit(2);
  }
  const results = [];
  const check = (name, ok, detail) => {
    results.push({ name, ok, detail });
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
  };

  // ---- load envelope ----
  let env;
  try {
    env = JSON.parse(await loadInput(args.envelope));
  } catch (e) {
    console.log(`FAIL  load — ${e.message}`);
    console.log('RESULT: FAIL'); process.exit(1);
  }

  // ---- 1. schema ----
  const missing = REQUIRED.filter(k => !(k in env));
  if (missing.length) check('schema', false, `missing fields: ${missing.join(', ')}`);
  else if (!TIERS.has(env.tier)) check('schema', false, `unknown tier "${env.tier}"`);
  else if (typeof env.protocol !== 'string' || !/^trust\/\d+\.\d+$/.test(env.protocol))
    check('schema', false, `bad protocol "${env.protocol}"`);
  else if (!env.signature || env.signature.alg !== 'Ed25519' || typeof env.signature.sig !== 'string')
    check('schema', false, 'signature must be { alg: "Ed25519", sig: <base64> }');
  else {
    const sigBytes = Buffer.from(env.signature.sig, 'base64');
    if (sigBytes.length !== 64) check('schema', false, `signature is ${sigBytes.length} bytes, expected 64`);
    else {
      const ev = env.evidence;
      if (!ev || typeof ev !== 'object' || !ev.method || !ev.observed_at || !ev.source_url)
        check('schema', false, 'evidence needs method, observed_at, source_url');
      else check('schema', true, `${env.claim_id} [${env.tier}] ${env.subject}`);
    }
  }

  // ---- 2. signature ----
  let sigOk = false, pubPem = null;
  try {
    const pubSrc = args.pubkey
      || defaultChainUrl(args.envelope)?.replace(/\/claims\/index\.json$/, '/keys/ed25519.pub')
      || './keys/ed25519.pub';
    pubPem = (await loadInput(pubSrc)).trim();
    const { signature, ...payload } = env;
    const msg = Buffer.from(canon(payload), 'utf8');
    const key = createPublicKey(pubPem);
    sigOk = verify(null, msg, key, Buffer.from(env.signature.sig, 'base64'));
    check('signature', sigOk, `Ed25519 over canonical payload (${canon(payload).length} bytes)`);
  } catch (e) {
    check('signature', false, `could not verify: ${e.message}`);
  }

  // ---- 3. chain ----
  const chainSrc = args.chain || defaultChainUrl(args.envelope);
  if (!chainSrc) {
    console.log('SKIP  chain — no --chain given and index URL not derivable');
  } else {
    try {
      const index = JSON.parse(await loadInput(chainSrc));
      const claimHash = sha256hex(canon(env));
      const entry = (index.claims || []).find(c => c.claim_id === env.claim_id);
      if (!entry) check('chain', false, 'claim_id not found in index');
      else if (entry.claim_hash !== claimHash)
        check('chain', false, `hash mismatch: envelope ${claimHash.slice(0, 12)}… vs index ${entry.claim_hash.slice(0, 12)}…`);
      else {
        // walk linkage
        const byHash = new Map(index.claims.map(c => [c.claim_hash, c]));
        let ok = true, h = claimHash, steps = 0;
        while (ok && steps <= index.claims.length + 1) {
          const e = byHash.get(h);
          if (!e) { ok = false; break; }
          if (e.prev_hash === GENESIS) { h = GENESIS; break; }
          if (!byHash.has(e.prev_hash)) { ok = false; break; }
          h = e.prev_hash; steps++;
        }
        if (!ok || h !== GENESIS) check('chain', false, 'prev_hash linkage broken before GENESIS');
        else if (index.tip_hash && !byHash.has(index.tip_hash))
          check('chain', false, 'index tip_hash not among claim hashes');
        else check('chain', true, `hash ${claimHash.slice(0, 12)}… links to GENESIS; tip ${String(index.tip_hash).slice(0, 12)}…`);
      }
    } catch (e) {
      check('chain', false, `could not check: ${e.message}`);
    }
  }

  const allPass = results.every(r => r.ok);
  console.log(`RESULT: ${allPass ? 'PASS' : 'FAIL'}`);
  process.exit(allPass ? 0 : 1);
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
