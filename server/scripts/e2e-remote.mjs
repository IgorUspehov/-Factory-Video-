#!/usr/bin/env node
// End-to-end check against a deployed API: register -> upload -> project -> render -> download, then confirms with the
// local R2 credentials that uploads/, renders/ and db/ objects really exist in the bucket. Prints no secrets.
//   node --env-file=.env scripts/e2e-remote.mjs https://factory-video-api.onrender.com [--prefix db/]
// Creates one throw-away test user on the target (e2e-<random>@example.com).
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { config } from '../src/config.js';
import { FFMPEG, probe } from '../src/media.js';
import { createLocalStorage } from '../src/storage/local.js';
import { createR2Storage } from '../src/storage/r2.js';

const BASE = (process.argv[2] ?? '').replace(/\/+$/, '');
const dbPrefix = process.argv.includes('--prefix') ? process.argv[process.argv.indexOf('--prefix') + 1] : 'db/';
if (!/^https?:\/\//.test(BASE)) (console.error('usage: e2e-remote.mjs <api base url> [--prefix db/]'), process.exit(2));
const sh = promisify(execFile);
const work = await mkdtemp(path.join(os.tmpdir(), 'e2e-'));
let failed = 0;
const check = (name, ok, extra = '') => (ok || failed++, console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(method, p, { token, json, form } = {}) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  let body = form;
  if (json !== undefined) (headers['Content-Type'] = 'application/json'), (body = JSON.stringify(json));
  const res = await fetch(BASE + p, { method, headers, body, signal: AbortSignal.timeout(120_000) });
  const text = await res.text();
  let data = text;
  try {
    data = JSON.parse(text);
  } catch {
    /* plain text */
  }
  return { status: res.status, data };
}
const formOf = async (file, extra = {}) => {
  const fd = new FormData();
  fd.append('file', new Blob([await readFile(file)]), path.basename(file));
  for (const [k, v] of Object.entries(extra)) fd.append(k, v);
  return fd;
};

try {
  // wake the service (Render Free sleeps)
  const t0 = Date.now();
  for (let i = 0; i < 40; i++) {
    const h = await fetch(`${BASE}/api/health`, { signal: AbortSignal.timeout(30_000) }).then((r) => r.ok, () => false);
    if (h) break;
    await sleep(3000);
  }
  check('API reachable', (await api('GET', '/api/health')).data?.ok === true, `${((Date.now() - t0) / 1000).toFixed(0)} s to wake`);

  // test material
  const photos = [];
  for (const [i, src] of ['testsrc2=s=640x1136:d=1', 'smptebars=s=640x1136:d=1'].entries()) {
    const f = path.join(work, `p${i}.jpg`);
    await sh(FFMPEG, ['-v', 'error', '-y', '-f', 'lavfi', '-i', src, '-frames:v', '1', f]);
    photos.push(f);
  }
  const audioFile = path.join(work, 'tone.mp3');
  await sh(FFMPEG, ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=6', '-c:a', 'libmp3lame', audioFile]);

  const email = `e2e-${Math.random().toString(36).slice(2, 8)}@example.com`;
  const reg = await api('POST', '/api/auth/register', { json: { email, password: 'e2e-Test-pass-1' } });
  check('register', reg.status === 201 && !!reg.data.token);
  const token = reg.data.token;

  const au = await api('POST', '/api/upload/audio', { token, form: await formOf(audioFile, { rightsConfirmed: 'true' }) });
  check('upload audio', au.status === 201, au.status === 201 ? '' : JSON.stringify(au.data).slice(0, 200));
  const media = [];
  for (const [i, f] of photos.entries()) {
    const up = await api('POST', '/api/upload/media', { token, form: await formOf(f) });
    check(`upload photo ${i + 1}`, up.status === 201);
    media.push({ id: up.data.id, kind: 'image', url: up.data.url, thumb: '', name: `p${i}.jpg`, source: 'upload' });
  }
  const upUrl = new URL(au.data.url);
  const userId = upUrl.pathname.split('/')[3];
  const upDownload = await fetch(au.data.url);
  check('uploaded file served from /files', upDownload.status === 200 && (await upDownload.arrayBuffer()).byteLength > 1000);

  const project = {
    title: 'E2E', goal: 'reels', lengthMode: 'timeline', format: '9:16', mood: 'calm', textMode: 'titles', nodes: [], edges: [],
    audio: { source: 'upload', id: au.data.id, name: 'tone.mp3', url: au.data.url, duration: 6, beats: [], peaks: [], rightsConfirmed: true },
    media, lyrics: [{ id: 'l1', text: 'R2 end-to-end', start: 0.5, end: 5 }],
    style: { background: '#0B0B0D', accent: '#FF6A1A', text: '#FFFFFF', font: 'Inter', transition: 'fade', kenBurns: true, beatSync: false, audioFadeIn: true, audioFadeOut: true },
    timeline: media.map((m, i) => ({ id: `c${i}`, mediaId: m.id, duration: 3 })), render: { status: 'idle', progress: 0 },
  };
  const created = await api('POST', '/api/projects', { token, json: project });
  check('create project', created.status === 201);

  const start = await api('POST', '/api/render', { token, json: { projectId: created.data.id, format: '9:16' } });
  check('start render', start.status === 201, JSON.stringify(start.data));
  const t1 = Date.now();
  let st;
  for (;;) {
    const r = await api('GET', `/api/render/${start.data.jobId}`, { token });
    st = r.data;
    if (r.status !== 200) {
      console.log(`      poll got HTTP ${r.status} ${JSON.stringify(r.data).slice(0, 120)}`);
      st = { status: `http_${r.status}` };
      break;
    }
    if (st.status === 'done' || st.status === 'failed' || Date.now() - t1 > 8 * 60_000) break;
    await sleep(3000);
  }
  check('render done', st.status === 'done', `${((Date.now() - t1) / 1000).toFixed(0)} s, ${st.status}`);
  if (st.status === 'done') {
    const res = await fetch(st.url);
    const file = path.join(work, 'out.mp4');
    await writeFile(file, Buffer.from(await res.arrayBuffer()));
    const info = await probe(file);
    check('download render', res.status === 200);
    check('720x1280 h264 + aac, 6 s', info.video?.width === 720 && info.video?.height === 1280 && info.video?.codec === 'h264' && info.audio?.codec === 'aac' && Math.abs(info.duration - 6) < 0.2, `${info.duration?.toFixed(2)} s`);
    const again = await fetch((await api('GET', `/api/render/${start.data.jobId}/link`, { token })).data.url);
    check('refreshed link downloads', again.status === 200);
  }

  // proof that R2 (not just the container disk) holds the data
  await sleep(4000); // db mirror interval
  const storage = createR2Storage({ local: createLocalStorage({ dataDir: work, publicUrl: 'http://x', secret: 's' }), ...config.r2 });
  const up = await storage.list(`uploads/${userId}/`);
  const rn = await storage.list(`renders/${userId}/`);
  const dbKeys = (await storage.list(dbPrefix)).map((k) => k.slice(dbPrefix.length));
  check('R2 holds the 3 uploads', up.length === 3, `${up.length} objects`);
  check('R2 holds the render', rn.length === 1, `${rn.length} object(s)`);
  const users = JSON.parse((await storage.getObject(`${dbPrefix}users.json`) ?? '[]').toString());
  check('R2 db mirror has the test user', users.some((u) => u.email === email), `collections: ${dbKeys.join(', ')}`);
  console.log(`\n(test user ${email}, id ${userId}; objects stay in the bucket)`);
} catch (err) {
  failed++;
  console.log('FAIL  exception:', err.name, String(err.message).slice(0, 300));
} finally {
  await rm(work, { recursive: true, force: true });
}
console.log(failed ? `\n${failed} check(s) FAILED` : '\nAll checks passed');
process.exit(failed ? 1 : 0);
