import { readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { withHeavyLock } from '../heavy.js';
import { probe } from '../media.js';
import { concatWav } from './audio.js';
import { composeReel } from './compose.js';
import { sleep } from './http.js';
import { splitForTts } from './text.js';

const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.wav': 'audio/wav', '.mp3': 'audio/mpeg' };
const dataUri = async (file) => `data:${MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream'};base64,${(await readFile(file)).toString('base64')}`;

export const avatarKeys = (userId) => ({ photo: (ext) => `avatar/${userId}/photo${ext}`, voice: (ext) => `avatar/${userId}/voice${ext}` });

/**
 * Avatar jobs: one job = one language = one reel.
 *   translate (Claude, only for en/de) -> TTS in chunks of <= 280 chars with the cloned voice -> one WAV
 *   -> talking-head video (RunPod, minutes) -> 1080x1920 reel (ffmpeg) -> storage (R2).
 * The long RunPod wait never holds an HTTP request or the ffmpeg lock. The RunPod job id is stored in the job row
 * the moment it exists, together with the chunk texts and durations, so after a restart `recover()` only polls
 * and composes — a paid job is never submitted twice. Everything before submission is cents and simply redone.
 *
 * @param {object} o
 * @param {object} o.db  @param {object} o.storage  @param {string} o.workRoot  (e.g. DATA_DIR/tmp/avatar)
 * @param {{translate: Function}} o.translator  @param {{synthesize: Function}} o.tts
 * @param {{submit: Function, status: Function, download: Function}} o.talk
 */
export function createAvatarQueue({ db, storage, workRoot, translator, tts, talk, concurrency = 2, pollMs = 5000, talkTimeoutMs = 25 * 60_000, linkTtlMs = 7 * 86_400_000, log = console }) {
  const pending = [];
  let active = 0;
  const running = new Set();

  const patch = (job, fields) => db.update('avatar_jobs', job.id, fields);

  async function stage(job, name, progress) {
    job.progress = Math.max(job.progress ?? 0, progress);
    await patch(job, { stage: name, progress: job.progress });
  }

  async function process(id) {
    const job = db.get('avatar_jobs', id);
    if (!job || !['queued', 'running'].includes(job.status)) return;
    const workDir = path.join(workRoot, job.id);
    const started = Date.now();
    await patch(job, { status: 'running', startedAt: job.startedAt ?? new Date().toISOString(), error: undefined });
    try {
      const profile = db.get('avatar_profiles', job.userId);
      if (!profile?.photoKey || !profile?.voiceKey) throw new Error('profile_incomplete');

      // ---- text: translate (cached in the row), then split into TTS chunks
      let chunks = job.chunks;
      if (!job.runpodId) {
        await stage(job, 'translate', 5);
        let text = job.language === 'ru' ? job.text : job.translatedText;
        if (!text) {
          text = await translator.translate(job.text, job.language);
          await patch(job, { translatedText: text });
        }
        const parts = splitForTts(text);
        if (!parts.length) throw new Error('empty_text');

        // ---- TTS per chunk with the owner's voice (cents; redone after a restart)
        await stage(job, 'tts', 10);
        const voiceRef = await dataUri(await storage.localPath(profile.voiceKey));
        const files = [];
        chunks = [];
        for (const [i, part] of parts.entries()) {
          const r = await tts.synthesize({ text: part, language: job.language, referenceAudio: voiceRef, outFile: path.join(workDir, `tts_${i}.wav`) });
          const info = await probe(r.file);
          if (!(info.duration > 0)) throw new Error('tts_empty_audio');
          files.push(r.file);
          chunks.push({ text: part, duration: info.duration });
          await stage(job, 'tts', 10 + Math.round(((i + 1) / parts.length) * 15));
        }
        const audio = await concatWav(files, path.join(workDir, 'voice.wav'));

        // ---- talking head: submit once, store the id before anything else
        await stage(job, 'talking', 26);
        const photo = await dataUri(await storage.localPath(profile.photoKey));
        const runpodId = await talk.submit({ image: photo, audio: await dataUri(audio) });
        await patch(job, { runpodId, chunks, submittedAt: new Date().toISOString() });
        job.runpodId = runpodId;
      }

      // ---- wait for RunPod (also the resume path after a restart)
      await stage(job, 'talking', 26);
      const seconds = chunks.reduce((n, c) => n + c.duration, 0);
      const expectedMs = Math.max(60_000, seconds * 12_000);
      const waitFrom = job.submittedAt ? new Date(job.submittedAt).getTime() : Date.now();
      let netErrors = 0;
      let result;
      for (;;) {
        if (Date.now() - waitFrom > talkTimeoutMs) throw new Error('talking_timeout');
        let st;
        try {
          st = await talk.status(job.runpodId);
          netErrors = 0;
        } catch (err) {
          if (++netErrors > 20) throw new Error(`provider_unreachable: ${err.message}`.slice(0, 300));
          await sleep(Math.min(pollMs * 2, 15_000));
          continue;
        }
        if (st.state === 'failed') throw new Error(`talking_failed: ${st.error ?? ''}`.slice(0, 300));
        if (st.state === 'done') {
          result = st;
          break;
        }
        const frac = Math.min(1, (Date.now() - waitFrom) / expectedMs);
        await stage(job, 'talking', 26 + Math.round(frac * 62));
        await sleep(pollMs);
      }
      const talkFile = await talk.download(result.resultUrl, path.join(workDir, 'talk.mp4'));

      // ---- reel (memory heavy: never together with a video render)
      await stage(job, 'compose', 90);
      const out = path.join(workDir, 'reel.mp4');
      const { duration } = await withHeavyLock(() => composeReel({ video: talkFile, chunks, out, workDir }));
      const key = `renders/${job.userId}/${job.id}.mp4`;
      await storage.put(key, out);
      await patch(job, {
        status: 'done', stage: 'done', progress: 100, key, duration, cost: result.cost,
        finishedAt: new Date().toISOString(), linkExpiresAt: new Date(Date.now() + linkTtlMs).toISOString(),
      });
      log.log(`[avatar] ${job.id} done in ${Math.round((Date.now() - started) / 1000)} s (${job.language}, ${duration.toFixed(1)} s)`);
    } catch (err) {
      log.error(`[avatar] ${job.id} failed:`, err.message);
      // runpodId stays in the row: the job can be resumed instead of paid again
      await patch(job, { status: 'failed', error: String(err.message).slice(0, 400), finishedAt: new Date().toISOString() });
    } finally {
      await rm(workDir, { recursive: true, force: true });
    }
  }

  function pump() {
    while (active < concurrency && pending.length) {
      const id = pending.shift();
      if (running.has(id)) continue;
      running.add(id);
      active++;
      void process(id).finally(() => {
        running.delete(id);
        active--;
        pump();
      });
    }
  }

  return {
    enqueue(id) {
      pending.push(id);
      pump();
    },
    /** Restart: unfinished jobs continue (jobs with a RunPod id only poll and compose). */
    recover() {
      const open = db.find('avatar_jobs', (j) => j.status === 'queued' || j.status === 'running').sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      for (const j of open) pending.push(j.id);
      if (open.length) log.log(`[avatar] recovered ${open.length} job(s)`);
      pump();
    },
    size: () => pending.length + active,
  };
}
