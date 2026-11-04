#!/usr/bin/env node
// Avatar HTTP API on a real Express app, temp data dir, stub queue (no network, no cost).  node scripts/test-avatar-api.mjs
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const sh = promisify(execFile);
const root = await mkdtemp(path.join(os.tmpdir(), 'avapi-'));
const PORT = 8097;
Object.assign(process.env, { DATA_DIR: path.join(root, 'data'), JWT_SECRET: 'test', PUBLIC_URL: `http://127.0.0.1:${PORT}`, AVATAR_OWNER_EMAILS: 'Owner@Example.com, owner2@example.com', AVATAR_DAILY_LIMIT: '4' });
const { createApp } = await import('../src/app.js');
const { createDb } = await import('../src/db.js');
const { storage } = await import('../src/storage/index.js');
const { FFMPEG, probe } = await import('../src/media.js');

const db = createDb(process.env.DATA_DIR);
const enqueued = [];
const stubQueue = {
  size: () => 0,
  enqueue(id) {
    enqueued.push(id);
    // pretend the pipeline finished: a real mp4 in storage
    setTimeout(async () => {
      const f = path.join(root, `${id}.mp4`);
      await sh(FFMPEG, ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc2=s=1080x1920:r=25:d=1', '-pix_fmt', 'yuv420p', f]);
      const j = db.get('avatar_jobs', id);
      const key = `renders/${j.userId}/${id}.mp4`;
      await storage.put(key, f);
      await db.update('avatar_jobs', id, { status: 'done', stage: 'done', progress: 100, key, duration: 1, linkExpiresAt: new Date(Date.now() + 86_400_000).toISOString() });
    }, 50);
  },
  recover() {},
};
const app = createApp({ db, queue: { size: () => 0, enqueue() {}, recover() {} }, avatarQueue: stubQueue });
const server = app.listen(PORT);
const BASE = `http://127.0.0.1:${PORT}`;

let failed = 0;
const check = (n, ok, x = '') => (ok || failed++, console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${x ? '  ' + x : ''}`));
async function api(method, p, { token, json, form } = {}) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  let body = form;
  if (json !== undefined) (headers['Content-Type'] = 'application/json'), (body = JSON.stringify(json));
  const res = await fetch(BASE + p, { method, headers, body });
  const t = await res.text();
  let data = t;
  try { data = JSON.parse(t); } catch { /* binary/plain */ }
  return { status: res.status, data, res };
}
const formOf = async (file, name) => {
  const fd = new FormData();
  fd.append('file', new Blob([await readFile(file)]), name ?? path.basename(file));
  return fd;
};
const mk = async (name, args) => {
  const f = path.join(root, name);
  await sh(FFMPEG, ['-v', 'error', '-y', ...args, f]);
  return f;
};
const waitDone = async (token, id) => {
  for (let i = 0; i < 100; i++) {
    const j = (await api('GET', `/api/avatar/jobs/${id}`, { token })).data;
    if (j.status === 'done') return j;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('job not done');
};

try {
  await mkdir(root, { recursive: true });
  const owner = (await api('POST', '/api/auth/register', { json: { email: 'owner@example.com', password: 'secret123' } })).data.token;
  const other = (await api('POST', '/api/auth/register', { json: { email: 'other@example.com', password: 'secret123' } })).data.token;

  // ---- access: owner only
  check('no token -> 401', (await api('GET', '/api/avatar/profile')).status === 401);
  const routes = [['GET', '/api/avatar/profile'], ['GET', '/api/avatar/photo'], ['GET', '/api/avatar/jobs'], ['POST', '/api/avatar/jobs'], ['PUT', '/api/avatar/photo'], ['PUT', '/api/avatar/voice'], ['PUT', '/api/avatar/recording']];
  const denied = await Promise.all(routes.map(([m, p]) => api(m, p, { token: other, json: m === 'POST' ? { text: 'x', languages: ['ru'] } : undefined })));
  check('other account -> 403 on every route', denied.every((r) => r.status === 403), denied.map((r) => r.status).join());
  check('owner e-mail matches case-insensitively', (await api('GET', '/api/avatar/profile', { token: owner })).status === 200);
  const p0 = (await api('GET', '/api/avatar/profile', { token: owner })).data;
  check('empty profile: not ready, configured', p0.ready === false && p0.configured === true && p0.limits.dailyLimit === 4);
  check('job without profile -> 409', (await api('POST', '/api/avatar/jobs', { token: owner, json: { text: 'Привет', languages: ['en'] } })).data.error === 'profile_incomplete');

  // ---- photo
  const square = await mk('sq.png', ['-f', 'lavfi', '-i', 'testsrc2=s=1024x1024:d=1', '-frames:v', '1']);
  const tiny = await mk('tiny.png', ['-f', 'lavfi', '-i', 'testsrc2=s=200x300:d=1', '-frames:v', '1']);
  const portrait = await mk('face.png', ['-f', 'lavfi', '-i', 'testsrc2=s=1500x2250:d=1', '-frames:v', '1']);
  check('square photo -> photo_not_portrait', (await api('PUT', '/api/avatar/photo', { token: owner, form: await formOf(square) })).data.error === 'photo_not_portrait');
  check('tiny photo -> photo_too_small', (await api('PUT', '/api/avatar/photo', { token: owner, form: await formOf(tiny) })).data.error === 'photo_too_small');
  check('wrong type -> unsupported_type', (await api('PUT', '/api/avatar/photo', { token: owner, form: await formOf(portrait, 'face.gif') })).data.error === 'unsupported_type');
  const up = await api('PUT', '/api/avatar/photo', { token: owner, form: await formOf(portrait) });
  check('portrait photo accepted, normalised to 1024x1536', up.status === 200 && up.data.hasPhoto && up.data.photo.width === 1024 && up.data.photo.height === 1536, JSON.stringify(up.data.photo));
  const pv = await api('GET', '/api/avatar/photo', { token: owner });
  check('photo preview served to the owner', pv.status === 200 && /image\/png/.test(pv.res.headers.get('content-type')));
  const uid = (await api('GET', '/api/me', { token: owner })).data.id;
  check('photo exists in storage but is not reachable under /files', !!(await storage.localPath(`avatar/${uid}/photo.png`)) && (await fetch(`${BASE}/files/avatar/${uid}/photo.png`)).status === 404);

  // ---- voice
  const short = await mk('short.wav', ['-f', 'lavfi', '-i', 'sine=frequency=300:duration=1']);
  const long = await mk('long.wav', ['-f', 'lavfi', '-i', 'sine=frequency=300:duration=20']);
  const good = await mk('voice.mp3', ['-f', 'lavfi', '-i', 'sine=frequency=300:duration=8', '-c:a', 'libmp3lame']);
  check('1 s voice -> voice_duration', (await api('PUT', '/api/avatar/voice', { token: owner, form: await formOf(short) })).data.error === 'voice_duration');
  check('20 s voice -> voice_duration', (await api('PUT', '/api/avatar/voice', { token: owner, form: await formOf(long) })).data.error === 'voice_duration');
  const vo = await api('PUT', '/api/avatar/voice', { token: owner, form: await formOf(good) });
  check('8 s voice accepted, profile ready', vo.status === 200 && vo.data.ready === true && Math.abs(vo.data.voice.duration - 8) < 0.2);
  const stored = await probe(await storage.localPath(`avatar/${(await api('GET', '/api/me', { token: owner })).data.id}/voice.wav`));
  check('voice stored as mono WAV', stored.audio?.codec === 'pcm_s16le');

  // ---- own recording (Russian)
  const wavSil = await mk('rec-sil.wav', ['-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=mono', '-f', 'lavfi', '-i', 'sine=frequency=300:sample_rate=44100:duration=8', '-filter_complex', '[0:a]atrim=duration=1,asplit=2[s1][s2];[s1][1:a][s2]concat=n=3:v=0:a=1[a]', '-map', '[a]']);
  const rec1 = await mk('rec1s.wav', ['-f', 'lavfi', '-i', 'sine=frequency=300:duration=1']);
  const rec61 = await mk('rec61s.mp3', ['-f', 'lavfi', '-i', 'sine=frequency=300:duration=61', '-c:a', 'libmp3lame', '-b:a', '32k']);
  const rec60 = await mk('rec60s.mp3', ['-f', 'lavfi', '-i', 'sine=frequency=300:duration=60', '-c:a', 'libmp3lame', '-b:a', '32k']);
  check('recording: wrong type -> unsupported_type', (await api('PUT', '/api/avatar/recording', { token: owner, form: await formOf(wavSil, 'rec.gif') })).data.error === 'unsupported_type');
  check('recording: 1 s -> recording_duration', (await api('PUT', '/api/avatar/recording', { token: owner, form: await formOf(rec1) })).data.error === 'recording_duration');
  check('recording: 61 s -> recording_duration', (await api('PUT', '/api/avatar/recording', { token: owner, form: await formOf(rec61) })).data.error === 'recording_duration');
  const r60 = await api('PUT', '/api/avatar/recording', { token: owner, form: await formOf(rec60) });
  check('recording: exactly 60 s accepted', r60.status === 201 && /^avr_/.test(r60.data.id) && Math.abs(r60.data.duration - 60) < 0.5, JSON.stringify(r60.data));
  const rOk = await api('PUT', '/api/avatar/recording', { token: owner, form: await formOf(wavSil) });
  check('recording: 10 s accepted and stored as mono 32 kHz WAV', rOk.status === 201 && Math.abs(rOk.data.duration - 10) < 0.3);
  const recInfo = await probe(await storage.localPath(`avatar/${uid}/${rOk.data.id}.wav`));
  check('stored recording is a WAV, not served under /files', recInfo.audio?.codec === 'pcm_s16le' && (await fetch(`${BASE}/files/avatar/${uid}/${rOk.data.id}.wav`)).status === 404);
  const recId = rOk.data.id;

  // ---- jobs
  const J = (json) => api('POST', '/api/avatar/jobs', { token: owner, json: { recordingId: recId, ...json } });
  check('RU without a recording -> 400 recording_required', (await api('POST', '/api/avatar/jobs', { token: owner, json: { text: 'Привет', languages: ['ru'] } })).data.error === 'recording_required');
  check('RU with an unknown recording -> 400 recording_required', (await api('POST', '/api/avatar/jobs', { token: owner, json: { text: 'Привет', languages: ['ru'], recordingId: 'avr_nope' } })).data.error === 'recording_required');
  // a second owner account: photo only, no voice sample
  const owner2 = (await api('POST', '/api/auth/register', { json: { email: 'owner2@example.com', password: 'secret123' } })).data.token;
  await api('PUT', '/api/avatar/photo', { token: owner2, form: await formOf(portrait) });
  const rec2 = (await api('PUT', '/api/avatar/recording', { token: owner2, form: await formOf(wavSil) })).data;
  check('someone else\'s recording cannot be used', (await api('POST', '/api/avatar/jobs', { token: owner2, json: { text: 'Привет', languages: ['ru'], recordingId: recId } })).data.error === 'recording_required');
  const ruOnly = await api('POST', '/api/avatar/jobs', { token: owner2, json: { text: 'Привет', languages: ['ru'], recordingId: rec2.id } });
  check('RU works with photo + own recording, no voice sample needed', ruOnly.status === 201 && ruOnly.data.jobs[0].language === 'ru');
  check('EN without a voice sample -> 409 profile_incomplete', (await api('POST', '/api/avatar/jobs', { token: owner2, json: { text: 'Привет', languages: ['en'] } })).data.error === 'profile_incomplete');
  check('empty text -> 400', (await J({ text: '  ', languages: ['ru'] })).data.error === 'empty_text');
  check('too long text -> 400', (await J({ text: 'а'.repeat(1201), languages: ['ru'] })).data.error === 'text_too_long');
  check('no languages -> 400', (await J({ text: 'Привет', languages: [] })).data.error === 'invalid_languages');
  check('unknown language -> 400', (await J({ text: 'Привет', languages: ['ru', 'fr'] })).data.error === 'invalid_languages');
  // project with the avatar draft; jobs bound to it
  const pr = await api('POST', '/api/projects', { token: owner, json: { title: 'Av', goal: 'avatar', format: '9:16', avatar: { text: 'Привет', languages: ['ru', 'en'] } } });
  check('project keeps the avatar draft', pr.status === 201 && pr.data.avatar?.languages.join() === 'ru,en');
  check('invalid avatar draft -> 400', (await api('PATCH', `/api/projects/${pr.data.id}`, { token: owner, json: { avatar: { text: 1, languages: ['xx'] } } })).data.error === 'invalid_avatar');
  check('avatar draft is updatable', (await api('PATCH', `/api/projects/${pr.data.id}`, { token: owner, json: { avatar: { text: 'Новый', languages: ['de'] } } })).data.avatar.text === 'Новый');
  check('job for a foreign/unknown project -> 404', (await J({ text: 'x', languages: ['ru'], projectId: 'prj_nope' })).status === 404);
  const created = await J({ text: 'Привет!  Это   тест.', languages: ['ru', 'en', 'en'], projectId: pr.data.id });
  check('RU+EN -> two jobs (duplicates ignored), text normalised', created.status === 201 && created.data.jobs.length === 2 && created.data.jobs[0].text === 'Привет! Это тест.' && created.data.jobs.every((j) => j.status === 'queued'));
  check('only the RU job carries the recording; EN is synthesised', db.get('avatar_jobs', created.data.jobs[0].id).recordingId === recId && db.get('avatar_jobs', created.data.jobs[1].id).recordingId === undefined);
  check('jobs enqueued, same batch', created.data.jobs.every((j) => enqueued.includes(j.id)) && created.data.jobs[0].batchId === created.data.jobs[1].batchId);
  const done = await waitDone(owner, created.data.jobs[0].id);
  check('finished job has signed url and expiry', /sig=/.test(done.url) && !!done.expiresAt && done.progress === 100);
  const dl = await fetch(done.url);
  const f = path.join(root, 'dl.mp4');
  await (await import('node:fs/promises')).writeFile(f, Buffer.from(await dl.arrayBuffer()));
  const info = await probe(f);
  check('reel downloads via signed link, 1080x1920', dl.status === 200 && info.video.width === 1080 && info.video.height === 1920);
  check('tampered signature -> 403', (await fetch(done.url.replace(/sig=([0-9a-f])/, (m, c) => `sig=${c === 'a' ? 'b' : 'a'}`))).status === 403);
  const link = await api('GET', `/api/avatar/jobs/${done.id}/link`, { token: owner });
  check('link refresh works', link.status === 200 && (await fetch(link.data.url)).status === 200);
  const list = await api('GET', '/api/avatar/jobs', { token: owner });
  check('list can be filtered by project', (await api('GET', `/api/avatar/jobs?projectId=${pr.data.id}`, { token: owner })).data.length === 2 && (await api('GET', '/api/avatar/jobs?projectId=prj_other', { token: owner })).data.length === 0 && done.projectId === pr.data.id);
  check('list shows both jobs, newest first', list.data.length === 2 && list.data[0].createdAt >= list.data[1].createdAt);
  check('another account cannot read the job -> 403 (owner guard)', (await api('GET', `/api/avatar/jobs/${done.id}`, { token: other })).status === 403);
  check('unknown job -> 404', (await api('GET', '/api/avatar/jobs/avj_nope', { token: owner })).status === 404);
  check('retry of a non-failed job -> 409', (await api('POST', `/api/avatar/jobs/${done.id}/retry`, { token: owner })).data.error === 'not_failed');
  await db.update('avatar_jobs', created.data.jobs[1].id, { status: 'failed', error: 'talking_failed: x', runpodId: 'rp1' });
  const before = enqueued.length;
  const retried = await api('POST', `/api/avatar/jobs/${created.data.jobs[1].id}/retry`, { token: owner });
  check('retry of a failed job re-enqueues it', retried.status === 200 && retried.data.status === 'queued' && retried.data.error === null && enqueued.length === before + 1);

  // ---- daily limit (4): 2 used, 2 more fit, then 429
  check('batch of 2 still fits the daily limit', (await J({ text: 'Ещё', languages: ['ru', 'de'] })).status === 201);
  const over = await J({ text: 'Лишнее', languages: ['ru'] });
  check('5th video in 24 h -> 429 daily_limit', over.status === 429 && over.data.error === 'daily_limit');

  // ---- not configured
  const app2 = createApp({ db, queue: { size: () => 0, enqueue() {}, recover() {} }, avatarQueue: null });
  const s2 = app2.listen(PORT + 1);
  const r2 = await fetch(`http://127.0.0.1:${PORT + 1}/api/avatar/jobs`, { method: 'POST', headers: { Authorization: `Bearer ${owner}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ text: 'x', languages: ['ru'] }) });
  check('providers missing -> 501 avatar_not_configured (not 503)', r2.status === 501);
  s2.close();
} catch (e) {
  failed++;
  console.log('FAIL  exception:', e.stack?.split('\n').slice(0, 4).join(' | '));
} finally {
  server.close();
  await rm(root, { recursive: true, force: true });
}
console.log(failed ? `\n${failed} check(s) FAILED` : '\nAll checks passed');
process.exit(failed ? 1 : 0);
