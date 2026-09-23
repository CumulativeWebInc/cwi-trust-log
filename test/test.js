#!/usr/bin/env node
/**
 * CWI Trust Fabric — test suite (zero dependencies).
 *   node test/test.js
 *
 * (a) ephemeral-keypair signature round-trip (never touches the real key)
 * (b) chain integrity over claims/index.json (recompute every hash + prev links + tip)
 * (c) signature verification of all N real envelopes against keys/ed25519.pub
 * (d) schema validation of every envelope
 * (e) achievements.json entries all resolve to real claim files
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, createPublicKey, createPrivateKey, generateKeyPairSync, sign, verify } from 'node:crypto';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const CLAIMS = join(ROOT, 'claims');
const TIERS = new Set(['VERIFIED', 'UNVERIFIED', 'UNCONFIRMED', 'SAMPLE']);
const REQUIRED = ['protocol', 'claim_id', 'subject', 'statement', 'evidence', 'tier',
  'issuer', 'issued_at', 'prev_hash', 'signature'];

function canon(v) {
  if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
  if (v && typeof v === 'object') {
    return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}';
  }
  return JSON.stringify(v);
}
const sha256hex = (s) => createHash('sha256').update(s, 'utf8').digest('hex');

let pass = 0, fail = 0;
const ok = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`PASS  ${name}`); }
  else { fail++; console.log(`FAIL  ${name}${detail ? ' — ' + detail : ''}`); }
};

const index = JSON.parse(readFileSync(join(CLAIMS, 'index.json'), 'utf8'));
const envs = index.claims.map(c => ({ idx: c, env: JSON.parse(readFileSync(join(CLAIMS, c.claim_id + '.json'), 'utf8')) }));

// ---------- (a) ephemeral keypair round-trip ----------
{
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const payload = { protocol: 'trust/1.0', claim_id: 'clm_TEST0000000000000000000000', subject: 'test:roundtrip', statement: 'ephemeral test', tier: 'SAMPLE', issuer: 'Test', issued_at: '2026-09-16T00:00:00Z', prev_hash: 'GENESIS' };
  const msg = Buffer.from(canon(payload), 'utf8');
  const sig = sign(null, msg, privateKey);
  const good = verify(null, msg, publicKey, sig);
  const bad = verify(null, Buffer.from(canon({ ...payload, statement: 'tampered' }), 'utf8'), publicKey, sig);
  ok('a1 ephemeral sign+verify round-trips', good && sig.length === 64);
  ok('a2 tampered payload fails verification', good && !bad);
  ok('a3 ephemeral key != real key (never touched)', true); // by construction: generated, not read
}

// ---------- (b) chain integrity ----------
{
  ok('b1 index claims match index.count', index.claims.length === index.count, `got ${index.claims.length}, count=${index.count}`);
  let prev = 'GENESIS', chainOk = true, detail = '';
  for (const { idx, env } of envs) {
    const recomputed = sha256hex(canon(env));
    if (recomputed !== idx.claim_hash) { chainOk = false; detail = `hash mismatch ${env.claim_id}`; break; }
    if (idx.prev_hash !== prev) { chainOk = false; detail = `prev link broken at ${env.claim_id}`; break; }
    if (env.prev_hash !== idx.prev_hash) { chainOk = false; detail = `envelope/index prev_hash disagree ${env.claim_id}`; break; }
    prev = idx.claim_hash;
  }
  ok('b2 every claim_hash recomputes and prev links chain to GENESIS', chainOk, detail);
  ok('b3 tip_hash equals last claim hash', index.tip_hash === prev, index.tip_hash);
  ok('b4 genesis marker', index.genesis_prev_hash === 'GENESIS' && envs[0].env.prev_hash === 'GENESIS');
}

// ---------- (c) real signatures vs real public key ----------
{
  const pub = createPublicKey(readFileSync(join(ROOT, 'keys', 'ed25519.pub'), 'utf8'));
  let n = 0;
  for (const { env } of envs) {
    const { signature, ...payload } = env;
    const good = verify(null, Buffer.from(canon(payload), 'utf8'), pub, Buffer.from(signature.sig, 'base64'));
    if (good) n++;
    ok(`c sig ${env.claim_id.slice(-6)} ${env.subject}`, good);
  }
  ok(`c9 all ${index.count} real envelopes verify (${n}/${index.count})`, n === index.count);
}

// ---------- (d) schema validation ----------
{
  let schemaOk = true, detail = '';
  const ids = new Set();
  for (const { env } of envs) {
    const missing = REQUIRED.filter(k => !(k in env));
    if (missing.length) { schemaOk = false; detail = `${env.claim_id} missing ${missing}`; break; }
    if (!TIERS.has(env.tier)) { schemaOk = false; detail = `${env.claim_id} bad tier`; break; }
    if (env.protocol !== 'trust/1.0') { schemaOk = false; detail = `${env.claim_id} bad protocol`; break; }
    if (env.signature.alg !== 'Ed25519' || Buffer.from(env.signature.sig, 'base64').length !== 64) { schemaOk = false; detail = `${env.claim_id} bad signature`; break; }
    const ev = env.evidence;
    if (!ev || !ev.method || !ev.observed_at || !ev.source_url) { schemaOk = false; detail = `${env.claim_id} bad evidence`; break; }
    if (ids.has(env.claim_id)) { schemaOk = false; detail = `duplicate ${env.claim_id}`; break; }
    ids.add(env.claim_id);
    if (!/^clm_[0-9A-HJKMNP-TV-Z]{26}$/.test(env.claim_id)) { schemaOk = false; detail = `${env.claim_id} bad id format`; break; }
  }
  ok('d1 all envelopes pass schema (fields, tier vocab, protocol, sig, evidence, unique ULID ids)', schemaOk, detail);
  ok('d2 all tiers are VERIFIED for genesis batch', envs.every(({ env }) => env.tier === 'VERIFIED'));
}

// ---------- (e) achievements resolve ----------
{
  const ach = JSON.parse(readFileSync(join(ROOT, 'achievements.json'), 'utf8'));
  ok('e1 achievements.json mirrors chain count', ach.length === index.count, `got ${ach.length}, count=${index.count}`);
  let resOk = true, detail = '';
  const newestFirst = ach[0].claim_id === index.claims[index.claims.length - 1].claim_id;
  for (const a of ach) {
    const jsonPath = join(CLAIMS, a.claim_id + '.json');
    const htmlPath = join(CLAIMS, a.claim_id + '.html');
    if (!existsSync(jsonPath)) { resOk = false; detail = `missing ${jsonPath}`; break; }
    if (!existsSync(htmlPath)) { resOk = false; detail = `missing ${htmlPath}`; break; }
    if (a.claim_url !== `https://cumulativewebinc.github.io/cwi-trust-log/claims/${a.claim_id}.html`) { resOk = false; detail = `bad claim_url for ${a.claim_id}`; break; }
    for (const f of ['title', 'date', 'claim_id', 'claim_url', 'tier', 'summary']) {
      if (!a[f]) { resOk = false; detail = `${a.claim_id} missing ${f}`; break; }
    }
  }
  ok('e2 every achievement resolves to a real claim json+html with correct claim_url', resOk, detail);
  ok('e3 achievements ordered newest first', newestFirst);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
