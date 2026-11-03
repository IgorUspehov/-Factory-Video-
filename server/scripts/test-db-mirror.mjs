#!/usr/bin/env node
// Self-test of the R2 database mirror (db.js + storage/r2.js) against the real bucket, under a throw-away prefix.
// Prints only PASS/FAIL. Run: node --env-file=.env scripts/test-db-mirror.mjs
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { config } from '../src/config.js';
import { createDb } from '../src/db.js';
import { createLocalStorage } from '../src/storage/local.js';
import { createR2Storage } from '../src/storage/r2.js';

const { r2 } = config;
for (const k of ['accountId', 'accessKeyId', 'secretAccessKey', 'bucket']) if (!r2[k]) (console.error(`R2 setting "${k}" is empty`), process.exit(2));
const root = await mkdtemp(path.join(os.tmpdir(), 'dbmirror-'));
const storage = createR2Storage({ local: createLocalStorage({ dataDir: root, publicUrl: 'http://x', secret: 's' }), ...r2 });
const prefix = `selftest-db/${randomUUID()}/`;
const mirror = {
  list: async () => (await storage.list(prefix)).map((k) => k.slice(prefix.length, -5)),
  get: async (n) => (await storage.getObject(`${prefix}${n}.json`))?.toString('utf8') ?? null,
  put: (n, t) => storage.putObject(`${prefix}${n}.json`, t),
};
let failed = 0;
const check = (name, ok) => (ok || failed++, console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`));
const dir = (n) => path.join(root, n);

try {
  // 1) writes reach R2 and a brand-new empty "server" gets them back (the Render redeploy case)
  const a = createDb(dir('a'), mirror);
  await a.hydrate();
  await a.insert('users', { id: 'u1', email: 'x@example.com', credits: 10 });
  await a.insert('projects', { id: 'p1', title: 'Hello Привет', userId: 'u1' });
  for (let i = 0; i < 20; i++) await a.update('users', 'u1', { credits: 10 - i }); // burst -> coalesced
  await a.flush();
  check('mirror has both collections', (await mirror.list()).sort().join() === 'projects,users');

  const b = createDb(dir('b'), mirror);
  const h = await b.hydrate();
  check('fresh server restores 2 collections', h.downloaded === 2 && h.uploaded === 0);
  check('rows identical after restore (latest of the burst)', b.get('users', 'u1')?.credits === 10 - 19);
  check('unicode survives', b.get('projects', 'p1')?.title === 'Hello Привет');

  // 2) writes after restore go on being mirrored; remove works
  await b.insert('jobs', { id: 'j1', status: 'queued' });
  await b.remove('projects', 'p1');
  await b.flush();
  const c = createDb(dir('c'), mirror);
  await c.hydrate();
  check('second generation sees new collection and removal', c.get('jobs', 'j1')?.status === 'queued' && !c.get('projects', 'p1'));

  // 3) first run after enabling the mirror: local-only data is uploaded, not lost
  await mkdir(path.join(dir('d'), 'db'), { recursive: true });
  await writeFile(path.join(dir('d'), 'db', 'legacy.json'), JSON.stringify([{ id: 'l1', v: 1 }]));
  const d = createDb(dir('d'), mirror);
  const hd = await d.hydrate();
  check('local-only collection uploaded', hd.uploaded === 1 && (await mirror.get('legacy')) !== null);

  // 4) a corrupt remote snapshot is refused
  await mirror.put('broken', '{not json');
  const e = createDb(dir('e'), mirror);
  check('corrupt snapshot rejected', await e.hydrate().then(() => false, () => true));

  // 5) mirror failure never breaks local writes
  const bad = createDb(dir('f'), { list: async () => [], get: async () => null, put: async () => { throw new Error('boom'); } });
  await bad.hydrate();
  const origErr = console.error;
  console.error = () => {};
  await bad.insert('users', { id: 'u9' });
  await bad.flush();
  console.error = origErr;
  check('upload failure leaves local data intact', bad.get('users', 'u9')?.id === 'u9');
} catch (err) {
  failed++;
  console.log('FAIL  exception:', err.name, String(err.message).slice(0, 200));
} finally {
  for (const k of await storage.list(prefix)) await storage.remove(k).catch(() => failed++);
  check('cleanup: prefix empty', (await storage.list(prefix)).length === 0);
  await rm(root, { recursive: true, force: true });
}
console.log(failed ? `\n${failed} check(s) FAILED` : '\nAll checks passed');
process.exit(failed ? 1 : 0);
