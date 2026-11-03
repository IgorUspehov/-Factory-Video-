#!/usr/bin/env node
// Self-test of the R2 storage driver against the real bucket. Prints only PASS/FAIL, sizes and hashes — never credentials.
//   node --env-file=.env scripts/test-r2.mjs
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { config } from '../src/config.js';
import { createLocalStorage } from '../src/storage/local.js';
import { createR2Storage } from '../src/storage/r2.js';

const { r2 } = config;
for (const k of ['accountId', 'accessKeyId', 'secretAccessKey', 'bucket']) if (!r2[k]) (console.error(`R2 setting "${k}" is empty`), process.exit(2));

const dataDir = await mkdtemp(path.join(os.tmpdir(), 'r2test-'));
const local = createLocalStorage({ dataDir, publicUrl: 'http://localhost', secret: 'test' });
const storage = createR2Storage({ local, ...r2 });
const sha = (b) => createHash('sha256').update(b).digest('hex').slice(0, 12);
let failed = 0;
const check = (name, ok, extra = '') => {
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`);
};

const id = randomUUID();
const upKey = `selftest/${id}/up.bin`;
const rnKey = `renders/selftest/${id}.mp4`;
const payload = randomBytes(6 * 1024 * 1024 + 123); // > 5 MB
try {
  const src1 = path.join(dataDir, 'src1');
  await writeFile(src1, payload);
  await storage.put(upKey, src1);
  check('put upload (6 MB)', await storage.exists(upKey));
  check('upload keeps a local cache copy', (await stat(local.filePath(upKey)).catch(() => null))?.size === payload.length);

  await rm(local.filePath(upKey));
  const [a, b] = await Promise.all([storage.localPath(upKey), storage.localPath(upKey)]);
  const got = await readFile(a);
  check('re-download after cache loss, same hash', a === b && sha(got) === sha(payload), `${got.length} B, sha ${sha(got)}`);

  const src2 = path.join(dataDir, 'src2');
  await writeFile(src2, payload.subarray(0, 1000));
  await storage.put(rnKey, src2);
  check('put render: source consumed, no cache copy', !(await stat(src2).catch(() => null)) && !(await stat(local.filePath(rnKey)).catch(() => null)));
  check('render available via R2', (await storage.available(rnKey)) === true);

  check('missing key -> available() false', (await storage.available(`selftest/${id}/nope.bin`)) === false);
  check('signed url verifies', storage.verify(rnKey, ...(u => [u.searchParams.get('exp'), u.searchParams.get('sig')])(new URL(storage.signedUrl(rnKey, new Date(Date.now() + 60000))))));
  check('path traversal rejected', await storage.put('../evil', src1).then(() => false, () => true));
} catch (err) {
  failed++;
  console.log('FAIL  exception:', err.name, err.$metadata?.httpStatusCode ?? '', String(err.message).slice(0, 200));
} finally {
  for (const k of [upKey, rnKey]) await storage.remove(k).catch((e) => (failed++, console.log('FAIL  cleanup', k.split('/')[0], e.name)));
  check('cleanup: objects gone', !(await storage.exists(upKey).catch(() => true)) && !(await storage.exists(rnKey).catch(() => true)));
  await rm(dataDir, { recursive: true, force: true });
}
console.log(failed ? `\n${failed} check(s) FAILED` : '\nAll checks passed');
process.exit(failed ? 1 : 0);
