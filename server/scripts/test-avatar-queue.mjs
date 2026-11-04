#!/usr/bin/env node
// Avatar queue with fake providers and real ffmpeg (no network, no cost).  node scripts/test-avatar-queue.mjs
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { measureLoudness } from '../src/avatar/audio.js';
import { createAvatarQueue } from '../src/avatar/queue.js';
import { createDb } from '../src/db.js';
import { FFMPEG, probe } from '../src/media.js';
import { createLocalStorage } from '../src/storage/local.js';

const sh = promisify(execFile);
const root = await mkdtemp(path.join(os.tmpdir(), 'avq-'));
const db = createDb(path.join(root, 'data'));
const storage = createLocalStorage({ dataDir: path.join(root, 'data'), publicUrl: 'http://x', secret: 's' });
let failed = 0;
const check = (n, ok, x = '') => (ok || failed++, console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${x ? '  ' + x : ''}`));
const quiet = { log() {}, error() {} };

// owner profile: any png + wav
const src = path.join(root, 'src');
await mkdir(src);
await sh(FFMPEG, ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc2=s=256x384:d=1', '-frames:v', '1', path.join(src, 'photo.png')]);
await sh(FFMPEG, ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'sine=frequency=300:duration=3', path.join(src, 'voice.wav')]);
await storage.put('avatar/u1/photo.png', path.join(src, 'photo.png'));
await storage.put('avatar/u1/voice.wav', path.join(src, 'voice.wav'));
await db.insert('avatar_profiles', { id: 'u1', photoKey: 'avatar/u1/photo.png', voiceKey: 'avatar/u1/voice.wav' });

const calls = { tts: [], submit: 0, translate: [] };
let ttsFail = false;
let talkOutcome = 'done';
const fakes = () => ({
  translator: { translate: async (t, to) => (calls.translate.push(to), `[${to}] ${t}`) },
  tts: {
    synthesize: async ({ text, language, referenceAudio, outFile }) => {
      if (ttsFail) throw new Error('tts_failed: boom');
      calls.tts.push({ language, chars: text.length, hasRef: referenceAudio.startsWith('data:audio/wav;base64,') });
      await mkdir(path.dirname(outFile), { recursive: true });
      await sh(FFMPEG, ['-v', 'error', '-y', '-f', 'lavfi', '-i', `sine=frequency=440:duration=${(text.length * 0.05).toFixed(2)}`, outFile]);
      return { file: outFile };
    },
  },
  talk: {
    submit: async ({ image, audio }) => {
      calls.submit++;
      if (!image.startsWith('data:image/png;base64,') || !audio.startsWith('data:audio/wav;base64,')) throw new Error('bad submit payload');
      await writeFile(path.join(root, 'sent.wav'), Buffer.from(audio.split(',')[1], 'base64'));
      return `rp-${calls.submit}`;
    },
    status: (() => {
      const n = new Map();
      return async (id) => {
        n.set(id, (n.get(id) ?? 0) + 1);
        if (talkOutcome === 'failed') return { state: 'failed', error: 'CUDA out of memory' };
        return n.get(id) < 3 ? { state: n.get(id) === 1 ? 'queued' : 'running' } : { state: 'done', resultUrl: 'fake://result', cost: 0.25 };
      };
    })(),
    download: async (_url, dest) => {
      const dur = (await probe(path.join(root, 'sent.wav'))).duration;
      await mkdir(path.dirname(dest), { recursive: true });
      await sh(FFMPEG, ['-v', 'error', '-y', '-f', 'lavfi', '-i', `testsrc2=s=512x768:r=25:d=${dur}`, '-f', 'lavfi', '-i', `sine=frequency=440:duration=${dur}`, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', dest]);
      return dest;
    },
  },
});
const makeQueue = () => createAvatarQueue({ db, storage, workRoot: path.join(root, 'work'), ...fakes(), pollMs: 20, log: quiet });
const newJob = async (id, language, extra = {}) => {
  await db.insert('avatar_jobs', { id, userId: 'u1', language, text: 'Привет! Меня зовут Игорь. Я делаю сайты для местного бизнеса.', status: 'queued', progress: 0, createdAt: new Date().toISOString(), ...extra });
  return id;
};
const finish = async (id, ms = 120_000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const j = db.get('avatar_jobs', id);
    if (j.status === 'done' || j.status === 'failed') return j;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('timeout ' + id);
};

try {
  // 1) Russian: no translation, reel produced
  const q = makeQueue();
  q.enqueue(await newJob('j-ru', 'ru'));
  const ru = await finish('j-ru');
  check('ru job done', ru.status === 'done' && ru.progress === 100 && ru.stage === 'done', ru.error ?? '');
  check('ru: no translation, TTS language ru with the voice sample', calls.translate.length === 0 && calls.tts.every((t) => t.language === 'ru' && t.hasRef));
  check('ru: RunPod submitted exactly once, id stored with chunks', calls.submit === 1 && ru.runpodId === 'rp-1' && ru.chunks?.length >= 1 && ru.chunks.every((c) => c.duration > 0));
  const reel = await storage.localPath(ru.key);
  const info = await probe(reel);
  check('reel 1080x1920 h264 + aac', info.video?.width === 1080 && info.video?.height === 1920 && info.audio?.codec === 'aac', `${info.duration.toFixed(1)} s`);
  check('reel length = audio length', Math.abs(info.duration - ru.chunks.reduce((n, c) => n + c.duration, 0)) < 0.3);
  check('key is renders/<user>/<job>.mp4 with expiry and cost', ru.key === 'renders/u1/j-ru.mp4' && !!ru.linkExpiresAt && ru.cost === 0.25);
  check('work dir cleaned', !(await readFile(path.join(root, 'work', 'j-ru', 'talk.mp4')).then(() => true, () => false)));

  // 2) English: translated once, TTS in English
  calls.tts.length = 0;
  q.enqueue(await newJob('j-en', 'en'));
  const en = await finish('j-en');
  check('en job done, translated to en', en.status === 'done' && calls.translate.join() === 'en' && en.translatedText.startsWith('[en]') && calls.tts.every((t) => t.language === 'en'));

  // 3) long text -> several chunks, all <= 280 chars
  calls.tts.length = 0;
  q.enqueue(await newJob('j-long', 'ru', { text: 'Это очень длинный рассказ о нашей студии. '.repeat(20) }));
  const long = await finish('j-long');
  check('long text split into chunks <= 280', long.status === 'done' && calls.tts.length >= 3 && calls.tts.every((t) => t.chars <= 280), `${calls.tts.length} chunks`);

  // 3b) own recording (RU): no translation, no synthesis, silence cut at both ends, subtitles share the speech
  await sh(FFMPEG, ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=mono', '-f', 'lavfi', '-i', 'sine=frequency=300:sample_rate=44100:duration=3', '-filter_complex', '[0:a]atrim=duration=1.2,asplit=2[a1][a2];[a1][1:a][a2]concat=n=3:v=0:a=1[a]', '-map', '[a]', path.join(src, 'rec.wav')]);
  await storage.put('avatar/u1/rec1.wav', path.join(src, 'rec.wav'));
  await db.insert('avatar_recordings', { id: 'avr_1', userId: 'u1', key: 'avatar/u1/rec1.wav', duration: 5.4 });
  const before = { tts: calls.tts.length, translate: calls.translate.length, submit: calls.submit };
  q.enqueue(await newJob('j-rec', 'ru', { recordingId: 'avr_1', text: 'Привет! Это моя настоящая запись, без синтеза.' }));
  const rec = await finish('j-rec');
  check('own recording: job done without translation or synthesis', rec.status === 'done' && calls.tts.length === before.tts && calls.translate.length === before.translate, rec.error ?? '');
  check('own recording: exactly one RunPod submission', calls.submit === before.submit + 1 && rec.runpodId === `rp-${calls.submit}`);
  const sentInfo = await probe(path.join(root, 'sent.wav'));
  check('silence is cut before sending: 3 s of speech + 0.5 s of room', Math.abs(sentInfo.duration - 3.5) < 0.25 && !!sentInfo.audio, `${sentInfo.duration.toFixed(2)} s sent`);
  const sentLufs = (await measureLoudness(path.join(root, 'sent.wav'))).I;
  check('the recording is sent at -14 LUFS (the source tone is about -21)', Math.abs(sentLufs + 14) <= 0.7 && Math.abs(rec.lufsBefore ?? sentLufs) >= 0, `${sentLufs.toFixed(2)} LUFS`);
  check('subtitles get the speech part only', rec.chunks.length === 1 && Math.abs(rec.chunks[0].start - 0.2) < 0.05 && Math.abs(rec.chunks[0].duration - 3) < 0.2, JSON.stringify(rec.chunks[0]));
  const recReel = await probe(await storage.localPath(rec.key));
  check('own recording: reel is 1080x1920 and as long as the trimmed audio', recReel.video?.width === 1080 && Math.abs(recReel.duration - sentInfo.duration) < 0.3, `${recReel.duration.toFixed(2)} s`);

  // 3c) RU needs no voice sample (profile with a photo only); EN still does
  await db.insert('avatar_profiles', { id: 'u2', photoKey: 'avatar/u1/photo.png' });
  await db.insert('avatar_recordings', { id: 'avr_2', userId: 'u2', key: 'avatar/u1/rec1.wav', duration: 5.4 });
  const s2 = calls.submit;
  q.enqueue(await newJob('j-ru-novoice', 'ru', { userId: 'u2', recordingId: 'avr_2' }));
  check('RU with own recording works without a voice sample', (await finish('j-ru-novoice')).status === 'done' && calls.submit === s2 + 1);
  q.enqueue(await newJob('j-en-novoice', 'en', { userId: 'u2' }));
  const noVoice = await finish('j-en-novoice');
  check('EN without a voice sample -> failed profile_incomplete, nothing submitted', noVoice.error === 'profile_incomplete' && calls.submit === s2 + 1);

  // 3d) broken recordings fail early and cost nothing
  q.enqueue(await newJob('j-rec-missing', 'ru', { recordingId: 'avr_gone' }));
  const missing = await finish('j-rec-missing');
  check('missing recording -> failed recording_missing, nothing submitted', missing.error === 'recording_missing' && calls.submit === s2 + 1 && !missing.runpodId);
  await sh(FFMPEG, ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=mono', '-t', '4', path.join(src, 'silent.wav')]);
  await storage.put('avatar/u1/silent.wav', path.join(src, 'silent.wav'));
  await db.insert('avatar_recordings', { id: 'avr_silent', userId: 'u1', key: 'avatar/u1/silent.wav', duration: 4 });
  q.enqueue(await newJob('j-rec-silent', 'ru', { recordingId: 'avr_silent' }));
  const silent = await finish('j-rec-silent');
  check('silent recording -> failed recording_silent, nothing submitted', silent.error === 'recording_silent' && calls.submit === s2 + 1);

  // 4) restart while RunPod is working: only polls, never submits again, no TTS
  const submits = calls.submit;
  const ttsBefore = calls.tts.length;
  await mkdir(path.join(root, 'work', 'j-resume'), { recursive: true });
  await writeFile(path.join(root, 'sent.wav'), await readFile(await storage.localPath('avatar/u1/voice.wav'))); // 3 s "audio sent earlier"
  await newJob('j-resume', 'ru', { status: 'running', stage: 'talking', progress: 40, runpodId: 'rp-old', submittedAt: new Date().toISOString(), chunks: [{ text: 'Привет, это проверка.', duration: 3 }] });
  const q2 = makeQueue();
  q2.recover();
  const resumed = await finish('j-resume');
  check('resume after restart finishes without a second submission or TTS', resumed.status === 'done' && calls.submit === submits && calls.tts.length === ttsBefore, resumed.error ?? '');

  // 5) failures are reported, never crash the queue
  ttsFail = true;
  q.enqueue(await newJob('j-ttsfail', 'ru'));
  const f1 = await finish('j-ttsfail');
  check('TTS failure -> failed, nothing submitted', f1.status === 'failed' && /tts_failed/.test(f1.error) && calls.submit === submits && !f1.runpodId);
  ttsFail = false;
  talkOutcome = 'failed';
  q.enqueue(await newJob('j-rpfail', 'ru'));
  const f2 = await finish('j-rpfail');
  check('RunPod failure -> failed with message, id kept for resume', f2.status === 'failed' && /CUDA/.test(f2.error) && !!f2.runpodId);
  talkOutcome = 'done';
  await db.insert('avatar_jobs', { id: 'j-noprof', userId: 'nobody', language: 'ru', text: 'x', status: 'queued', progress: 0, createdAt: new Date().toISOString() });
  q.enqueue('j-noprof');
  check('no profile -> failed profile_incomplete', (await finish('j-noprof')).error === 'profile_incomplete');
  q.enqueue(await newJob('j-after', 'ru'));
  check('queue still works after failures', (await finish('j-after')).status === 'done');
} catch (e) {
  failed++;
  console.log('FAIL  exception:', e.stack?.split('\n').slice(0, 4).join(' | '));
} finally {
  await rm(root, { recursive: true, force: true });
}
console.log(failed ? `\n${failed} check(s) FAILED` : '\nAll checks passed');
process.exit(failed ? 1 : 0);
