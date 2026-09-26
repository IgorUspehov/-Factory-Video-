/**
 * End-to-end smoke test: starts its own server on a temporary DATA_DIR, generates test media with ffmpeg
 * and walks the whole API (auth → uploads → analysis → projects → renders in all formats → links → errors).
 * Usage: npm run smoke            (set SMOKE_REAL_TRACK=0 to skip downloading a SoundHelix track)
 */
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { readFileSync, readdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FFMPEG, probe, run } from '../src/media.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 18000 + Math.floor(Math.random() * 1000);
const BASE = `http://127.0.0.1:${PORT}`;
const work = await mkdtemp(path.join(os.tmpdir(), 'fv-smoke-'));
const dataDir = path.join(work, 'data');
const results = [];
let failed = 0;

function check(name, ok, detail = '') {
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
  if (!ok) failed++;
  console.log(results.at(-1));
}

// ---------------------------------------------------------------- memory sampling (Linux /proc)
function rssTreeMb(pid) {
  let total = 0;
  const kids = new Map();
  for (const d of readdirSync('/proc')) {
    if (!/^\d+$/.test(d)) continue;
    try {
      const ppid = Number(readFileSync(`/proc/${d}/stat`, 'utf8').split(') ')[1].split(' ')[1]);
      if (!kids.has(ppid)) kids.set(ppid, []);
      kids.get(ppid).push(Number(d));
    } catch {
      /* process exited */
    }
  }
  const walk = (p) => {
    try {
      const m = readFileSync(`/proc/${p}/status`, 'utf8').match(/VmRSS:\s+(\d+)/);
      if (m) total += Number(m[1]);
    } catch {
      /* exited */
    }
    for (const c of kids.get(p) ?? []) walk(c);
  };
  walk(pid);
  return total / 1024;
}

// ---------------------------------------------------------------- server
const server = spawn(process.execPath, ['src/index.js'], {
  cwd: root,
  env: { ...process.env, PORT: String(PORT), DATA_DIR: dataDir, JWT_SECRET: 'smoke-secret', PUBLIC_URL: BASE, FRONTEND_ORIGIN: 'http://localhost:5173', PEXELS_API_KEY: '' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let serverLog = '';
server.stdout.on('data', (d) => (serverLog += d));
server.stderr.on('data', (d) => (serverLog += d));
let peakMb = 0;
let sampling = false;
const sampler = setInterval(() => {
  if (sampling) peakMb = Math.max(peakMb, rssTreeMb(server.pid));
}, 150);

async function api(method, p, { token, json, form } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let body;
  if (form) body = form;
  else if (json !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(json);
  }
  const res = await fetch(BASE + p, { method, headers, body });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: res.status, data, headers: res.headers };
}

const fileForm = async (file, extra = {}) => {
  const fd = new FormData();
  fd.append('file', new Blob([await readFile(file)]), path.basename(file));
  for (const [k, v] of Object.entries(extra)) fd.append(k, v);
  return fd;
};

async function waitFor(fn, timeoutMs, stepMs = 500) {
  const end = Date.now() + timeoutMs;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > end) throw new Error('timeout');
    await new Promise((r) => setTimeout(r, stepMs));
  }
}

async function renderAndCheck(token, projectId, format, expected, label) {
  const [w, h] = { '9:16': [720, 1280], '16:9': [1280, 720], '1:1': [720, 720] }[format];
  const t0 = Date.now();
  const start = await api('POST', '/api/render', { token, json: { projectId, title: 'smoke', format, duration: expected } });
  check(`${label}: POST /api/render`, start.status === 201 && start.data.jobId && start.data.cost >= 1, JSON.stringify(start.data));
  const status = await waitFor(async () => {
    const s = await api('GET', `/api/render/${start.data.jobId}`, { token });
    return s.data.status === 'done' || s.data.status === 'failed' ? s.data : null;
  }, 15 * 60_000);
  const ms = Date.now() - t0;
  check(`${label}: job done`, status.status === 'done', status.status === 'done' ? `${ms} ms` : serverLog.split('\n').filter((l) => l.includes('failed')).slice(-1)[0]);
  if (status.status !== 'done') return { ms };
  const file = path.join(work, `${label.replace(/\W+/g, '_')}.mp4`);
  const res = await fetch(status.url);
  await writeFile(file, Buffer.from(await res.arrayBuffer()));
  const info = await probe(file);
  check(`${label}: download ${res.status}`, res.status === 200);
  check(`${label}: ${w}x${h} h264`, info.video?.width === w && info.video?.height === h && info.video?.codec === 'h264', JSON.stringify(info.video));
  check(`${label}: aac audio`, info.audio?.codec === 'aac', JSON.stringify(info.audio));
  check(`${label}: duration ${expected}s`, Math.abs(info.duration - expected) <= 0.1, `got ${info.duration?.toFixed(3)}`);
  check(`${label}: watermark flag`, status.watermark === true);
  check(`${label}: expiresAt ≈ +7d`, Math.abs(new Date(status.expiresAt).getTime() - Date.now() - 7 * 86_400_000) < 120_000, status.expiresAt);
  return { ms, file, jobId: start.data.jobId, status };
}

try {
  // ---------------------------------------------------------------- test media
  const gen = (args) => run(FFMPEG, ['-hide_banner', '-v', 'error', '-y', ...args]);
  const audioFile = path.join(work, 'beat120.mp3');
  // 120 BPM: a decaying 55 Hz kick every 0.5 s plus a hat every 0.25 s
  await gen(['-f', 'lavfi', '-i', "aevalsrc='0.9*sin(2*PI*55*t)*exp(-25*mod(t\\,0.5))+0.15*sin(2*PI*3300*t)*exp(-60*mod(t\\,0.25))':s=44100:d=40", '-c:a', 'libmp3lame', '-b:a', '128k', audioFile]);
  const photos = [];
  for (let i = 0; i < 10; i++) {
    const f = path.join(work, `photo${i}.jpg`);
    await gen(['-f', 'lavfi', '-i', `testsrc2=s=1600x1200:d=10`, '-ss', String(i), '-frames:v', '1', f]);
    photos.push(f);
  }
  const clipFile = path.join(work, 'clip.mp4');
  await gen(['-f', 'lavfi', '-i', 'testsrc=s=1280x720:r=25:d=2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', clipFile]);

  await waitFor(async () => (await fetch(`${BASE}/api/health`).catch(() => null))?.ok, 15_000, 200);
  check('GET /api/health', (await api('GET', '/api/health')).status === 200);

  // ---------------------------------------------------------------- auth
  const reg = await api('POST', '/api/auth/register', { json: { email: 'smoke@example.com', password: 'secret123' } });
  check('register → token', reg.status === 201 && typeof reg.data.token === 'string');
  const token = reg.data.token;
  check('register duplicate → 409', (await api('POST', '/api/auth/register', { json: { email: 'smoke@example.com', password: 'secret123' } })).status === 409);
  check('login wrong password → 401', (await api('POST', '/api/auth/login', { json: { email: 'smoke@example.com', password: 'wrong-pass' } })).status === 401);
  check('login → token', (await api('POST', '/api/auth/login', { json: { email: 'smoke@example.com', password: 'secret123' } })).data.token?.length > 20);
  const me = await api('GET', '/api/me', { token });
  check('GET /api/me free + 10 credits', me.data.plan === 'free' && me.data.credits === 10, JSON.stringify(me.data));
  check('GET /api/me without token → 401', (await api('GET', '/api/me')).status === 401);

  // ---------------------------------------------------------------- uploads + analysis
  const noRights = await api('POST', '/api/upload/audio', { token, form: await fileForm(audioFile) });
  check('upload audio without rightsConfirmed → 400', noRights.status === 400 && noRights.data.error === 'rights_not_confirmed', JSON.stringify(noRights.data));
  const badType = await api('POST', '/api/upload/audio', { token, form: await fileForm(photos[0], { rightsConfirmed: 'true' }) });
  check('upload audio with .jpg → 400', badType.status === 400, JSON.stringify(badType.data));
  const au = await api('POST', '/api/upload/audio', { token, form: await fileForm(audioFile, { rightsConfirmed: 'true' }) });
  check('upload audio with rightsConfirmed', au.status === 201 && au.data.url, JSON.stringify(au.data));
  const an = await api('POST', '/api/audio/analyze', { token, json: { id: au.data.id, url: au.data.url, duration: 40 } });
  const bpmOk = Math.abs(an.data.bpm - 120) <= 2;
  check('analyze: bpm ≈ 120, beats, peaks', bpmOk && an.data.beats.length > 50 && an.data.peaks.length === 120, `bpm ${an.data.bpm}, beats ${an.data.beats?.length}, duration ${an.data.duration}`);

  const media = [];
  for (const [i, f] of photos.entries()) {
    const up = await api('POST', '/api/upload/media', { token, form: await fileForm(f) });
    if (i < 3) check(`upload photo ${i + 1}`, up.status === 201, JSON.stringify(up.data));
    media.push({ id: up.data.id, kind: 'image', url: up.data.url, thumb: '', name: `photo${i}.jpg`, source: 'upload' });
  }
  const vid = await api('POST', '/api/upload/media', { token, form: await fileForm(clipFile) });
  check('upload video', vid.status === 201);
  media.push({ id: vid.data.id, kind: 'video', url: vid.data.url, thumb: '', name: 'clip.mp4', duration: 2, source: 'upload' });

  // ---------------------------------------------------------------- project
  const style = { background: '#0B0B0D', accent: '#FF6A1A', text: '#FFFFFF', font: 'Bebas Neue', transition: 'fade', kenBurns: true, beatSync: true, audioFadeIn: true, audioFadeOut: true };
  const timeline = [
    { id: 'c1', mediaId: media[0].id, duration: 2.5 },
    { id: 'c2', mediaId: media[10].id, duration: 3 },
    { id: 'c3', mediaId: media[1].id, duration: 2.5 },
    { id: 'c4', mediaId: media[2].id, duration: 2 },
  ];
  const project = {
    title: 'Smoke', goal: 'clip', format: '9:16', mood: 'energetic', textMode: 'lyrics', nodes: [], edges: [],
    audio: { source: 'upload', id: au.data.id, name: 'beat120.mp3', url: au.data.url, duration: an.data.duration, bpm: an.data.bpm, beats: an.data.beats, peaks: an.data.peaks, rightsConfirmed: true },
    media: [media[0], media[1], media[2], media[10]],
    lyrics: [
      { id: 'l1', text: 'Block für Block — Äöü', start: 0.5, end: 4 },
      { id: 'l2', text: 'Собери свой ролик', start: 4.5, end: 9 },
    ],
    style, timeline, render: { status: 'idle', progress: 0 },
  };
  const created = await api('POST', '/api/projects', { token, json: project });
  check('POST /api/projects', created.status === 201 && created.data.id?.startsWith('prj_'));
  const pid = created.data.id;
  check('GET /api/projects lists it', (await api('GET', '/api/projects', { token })).data.some((p) => p.id === pid));

  const reg2 = await api('POST', '/api/auth/register', { json: { email: 'other@example.com', password: 'secret123' } });
  check('other user cannot read project → 404', (await api('GET', `/api/projects/${pid}`, { token: reg2.data.token })).status === 404);

  // ---------------------------------------------------------------- renders: 3 formats, 4 transitions
  const cases = [
    ['9:16', 'fade'],
    ['16:9', 'slide'],
    ['1:1', 'cut'],
    ['9:16', 'zoom'],
  ];
  const renders = [];
  for (const [format, transition] of cases) {
    await api('PATCH', `/api/projects/${pid}`, { token, json: { style: { ...style, transition } } });
    renders.push(await renderAndCheck(token, pid, format, 10, `${format} ${transition}`));
  }
  // optional: keep sample frames for visual inspection
  if (process.env.SMOKE_OUT) {
    for (const [i, r] of renders.entries()) {
      for (const t of ['2.7', '5']) {
        if (r.file) await run(FFMPEG, ['-v', 'error', '-y', '-ss', t, '-i', r.file, '-frames:v', '1', '-update', '1', path.join(process.env.SMOKE_OUT, `frame-${i}-${t}s.png`)]).catch(() => {});
      }
    }
  }

  // ---------------------------------------------------------------- links
  const first = renders[0];
  if (first.jobId) {
    const tampered = first.status.url.replace(/sig=([0-9a-f])/, (m, c) => `sig=${c === 'a' ? 'b' : 'a'}`);
    check('tampered signature → 403', (await fetch(tampered)).status === 403);
    await new Promise((r) => setTimeout(r, 1100));
    const link = await api('GET', `/api/render/${first.jobId}/link`, { token });
    check('GET /render/:id/link → new expiry', link.status === 200 && link.data.expiresAt > first.status.expiresAt && link.data.url !== first.status.url, link.data.expiresAt);
    check('refreshed link downloads', (await fetch(link.data.url)).status === 200);
  }

  // ---------------------------------------------------------------- 30-second performance render
  const perfTimeline = photos.map((_, i) => ({ id: `p${i}`, mediaId: media[i].id, duration: 3 }));
  const perf = await api('POST', '/api/projects', {
    token,
    json: { ...project, title: 'Perf 30s', media: media.slice(0, 10), timeline: perfTimeline, style: { ...style, transition: 'fade', beatSync: false } },
  });
  peakMb = 0;
  sampling = true;
  const perfRes = await renderAndCheck(token, perf.data.id, '9:16', 30, 'perf 30s 9:16');
  sampling = false;
  const perfPeak = peakMb;

  // 60 short clips, same 30 s: memory must not grow with the clip count
  const manyTimeline = Array.from({ length: 60 }, (_, i) => ({ id: `m${i}`, mediaId: media[i % 10].id, duration: 0.5 }));
  const many = await api('POST', '/api/projects', {
    token,
    json: { ...project, title: 'Many clips', media: media.slice(0, 10), timeline: manyTimeline, style: { ...style, transition: 'fade', beatSync: false } },
  });
  peakMb = 0;
  sampling = true;
  const manyRes = await renderAndCheck(token, many.data.id, '9:16', 30, 'perf 60 clips 9:16');
  sampling = false;
  const manyPeak = peakMb;

  // ---------------------------------------------------------------- credits
  const credits = (await api('GET', '/api/me', { token })).data.credits;
  check('credits deducted (6 renders × 1)', credits === 4, `credits ${credits}`);
  const long = await api('POST', '/api/projects', {
    token,
    json: { ...project, title: 'Too expensive', timeline: Array.from({ length: 10 }, (_, i) => ({ id: `x${i}`, mediaId: media[i % 10].id, duration: 30 })), media: media.slice(0, 10) },
  });
  const r402 = await api('POST', '/api/render', { token, json: { projectId: long.data.id, format: '9:16' } });
  check('render with insufficient credits → 402', r402.status === 402 && r402.data.error === 'insufficient_credits', JSON.stringify(r402.data));
  check('credits unchanged after 402', (await api('GET', '/api/me', { token })).data.credits === 4);

  // ---------------------------------------------------------------- misc endpoints
  const hist = await api('GET', '/api/billing/history', { token });
  check('billing history has 6 renders', hist.data.length === 6 && hist.data.every((h) => h.status === 'done'));
  check('billing checkout → 501', (await api('POST', '/api/billing/checkout', { token, json: { product: 'pro' } })).status === 501);
  check('billing portal → 501', (await api('GET', '/api/billing/portal', { token })).status === 501);
  const lib = await api('GET', '/api/library/audio?mood=calm', { token });
  check('library audio mood filter', lib.data.length === 2 && lib.data.every((t) => t.mood === 'calm'));
  const libm = await api('GET', '/api/library/media?niche=music', { token });
  check('library media without Pexels key → static list', libm.headers.get('x-library-source') === 'static' && libm.data.length > 0 && libm.data.every((m) => m.niche === 'music'));
  const asst = await api('POST', '/api/assistant', { token, json: { projectId: pid, message: 'Что дальше?', lang: 'ru', context: {} } });
  check('assistant ru', /[а-я]/i.test(asst.data.suggestion ?? ''), (asst.data.suggestion ?? '').slice(0, 60));
  check('DELETE project', (await api('DELETE', `/api/projects/${long.data.id}`, { token })).status === 200);

  // ---------------------------------------------------------------- real track
  if (process.env.SMOKE_REAL_TRACK !== '0') {
    const t0 = Date.now();
    const real = await api('POST', '/api/audio/analyze', { token, json: { id: 'trk-1' } });
    check('analyze real track trk-1 (SoundHelix 1)', real.status === 200 && real.data.bpm > 0, `bpm ${real.data.bpm}, beats ${real.data.beats?.length}, duration ${real.data.duration}s, ${Date.now() - t0} ms incl. download`);
  }

  console.log('\n==== MEASUREMENTS');
  console.log(`30 s video (10 photos, Ken Burns, fade, audio, text, watermark) 9:16: ${perfRes.ms} ms wall time`);
  console.log(`peak RSS of server + ffmpeg during that render: ${Math.round(perfPeak)} MB`);
  console.log(`30 s video from 60 clips (0.5 s each, fade): ${manyRes.ms} ms wall time, peak RSS ${Math.round(manyPeak)} MB`);
  console.log(`machine: ${os.cpus().length}× ${os.cpus()[0]?.model}, ${Math.round(os.totalmem() / 1e9)} GB RAM`);
} catch (err) {
  check('smoke script', false, err.stack);
} finally {
  clearInterval(sampler);
  server.kill('SIGTERM');
  await new Promise((r) => setTimeout(r, 500));
  await rm(work, { recursive: true, force: true });
  console.log(`\n==== ${results.length - failed}/${results.length} passed`);
  if (failed) console.log('\n---- server log (tail)\n' + serverLog.split('\n').slice(-25).join('\n'));
  process.exit(failed ? 1 : 0);
}
