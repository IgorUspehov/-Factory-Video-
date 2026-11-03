#!/usr/bin/env node
// Composes a reel from a talking-head MP4 and prints the checks. No network, no cost.
//   node scripts/test-avatar-compose.mjs <talking-head.mp4> <out.mp4> "<text of chunk 1>|<dur>" "<text of chunk 2>|<dur>" ...
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { composeReel } from '../src/avatar/compose.js';
import { probe } from '../src/media.js';

const [video, out, ...rest] = process.argv.slice(2);
const chunks = rest.map((r) => ({ text: r.slice(0, r.lastIndexOf('|')), duration: Number(r.slice(r.lastIndexOf('|') + 1)) }));
const workDir = await mkdtemp(path.join(os.tmpdir(), 'reel-'));
let failed = 0;
const check = (n, ok, x = '') => (ok || failed++, console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${x ? '  ' + x : ''}`));
const t0 = Date.now();
try {
  const src = await probe(video);
  const r = await composeReel({ video, chunks, out, workDir });
  const info = await probe(r.file);
  check('1080x1920 h264', info.video?.width === 1080 && info.video?.height === 1920 && info.video?.codec === 'h264', JSON.stringify(info.video));
  check('aac audio kept', info.audio?.codec === 'aac');
  check('duration equals source', Math.abs(info.duration - src.duration) < 0.2, `${info.duration.toFixed(2)} s vs ${src.duration.toFixed(2)} s`);
  console.log(`compose took ${((Date.now() - t0) / 1000).toFixed(1)} s`);
} catch (e) {
  failed++;
  console.log('FAIL  exception:', e.message);
} finally {
  await rm(workDir, { recursive: true, force: true });
}
process.exit(failed ? 1 : 0);
