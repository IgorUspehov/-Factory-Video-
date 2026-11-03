import { randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { config, limits } from '../config.js';
import { HttpError, wrap } from '../errors.js';
import { FFMPEG, probe, run } from '../media.js';
import { storage } from '../storage/index.js';
import { avatarKeys } from './queue.js';

export const LANGUAGES = ['ru', 'en', 'de'];
export const LIMITS = { textChars: 1200, photoBytes: 12 * 1024 * 1024, voiceBytes: 10 * 1024 * 1024, voiceSeconds: [3, 12], photoMinWidth: 400, photoRatio: [1.3, 1.85], photoMaxWidth: 1024 };
const PHOTO_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp']);
const VOICE_EXT = new Set(['.wav', '.mp3', '.m4a', '.ogg', '.webm']);

const publicJob = (j) => ({
  id: j.id,
  batchId: j.batchId,
  language: j.language,
  text: j.text,
  status: j.status,
  stage: j.stage ?? null,
  progress: j.progress ?? 0,
  error: j.status === 'failed' ? j.error ?? 'failed' : null,
  url: j.status === 'done' ? storage.signedUrl(j.key, j.linkExpiresAt) : null,
  expiresAt: j.status === 'done' ? j.linkExpiresAt : null,
  duration: j.duration ?? null,
  createdAt: j.createdAt,
  finishedAt: j.finishedAt ?? null,
});

/**
 * Avatar API. The avatar is the owner's own face and voice, so every route is limited to AVATAR_OWNER_EMAILS.
 * Photo and voice sample are stored once per user and reused by every job; they are private (never under
 * /files). One job = one language = one reel.
 * @param {import('express').Express} app
 * @param {{db: object, auth: Function, withUpload: Function, queue: object | null}} ctx  queue is null when the providers are not configured
 */
export function registerAvatarRoutes(app, { db, auth, withUpload, queue }) {
  const owner = (req, _res, next) => {
    const ok = config.avatar.ownerEmails.includes(String(req.user?.email ?? '').toLowerCase());
    next(ok ? undefined : new HttpError(403, 'forbidden'));
  };
  const guard = [auth, owner];
  const profileOf = (userId) => db.get('avatar_profiles', userId);
  const ownJob = (req) => {
    const j = db.get('avatar_jobs', req.params.id);
    if (!j || j.userId !== req.user.id) throw new HttpError(404, 'not_found');
    return j;
  };
  const needQueue = () => {
    if (!queue) throw new HttpError(503, 'avatar_not_configured');
  };

  const publicProfile = (p) => ({
    configured: !!queue,
    hasPhoto: !!p?.photoKey,
    hasVoice: !!p?.voiceKey,
    ready: !!(p?.photoKey && p?.voiceKey),
    photo: p?.photoKey ? { width: p.photoWidth, height: p.photoHeight, updatedAt: p.photoAt } : null,
    voice: p?.voiceKey ? { duration: p.voiceDuration, updatedAt: p.voiceAt } : null,
    limits: { textChars: LIMITS.textChars, languages: LANGUAGES, dailyLimit: config.avatar.dailyLimit, voiceSeconds: LIMITS.voiceSeconds },
  });
  const saveProfile = async (userId, fields) => {
    if (profileOf(userId)) await db.update('avatar_profiles', userId, fields);
    else await db.insert('avatar_profiles', { id: userId, ...fields });
  };

  // ---------------------------------------------------------------- profile (photo + voice sample, set once)
  app.get('/api/avatar/profile', ...guard, (req, res) => res.json(publicProfile(profileOf(req.user.id))));

  app.put('/api/avatar/photo', ...guard, withUpload(LIMITS.photoBytes, async (req, res) => {
    if (!PHOTO_EXT.has(path.extname(req.file.originalname).toLowerCase())) throw new HttpError(400, 'unsupported_type');
    const info = await probe(req.file.path).catch(() => null);
    const v = info?.video;
    if (!v?.width || !v?.height) throw new HttpError(400, 'invalid_file');
    if (v.width < LIMITS.photoMinWidth) throw new HttpError(400, 'photo_too_small');
    const ratio = v.height / v.width;
    // the video follows the photo: a square photo gives a square video that would be cut to a thin strip in 9:16
    if (ratio < LIMITS.photoRatio[0] || ratio > LIMITS.photoRatio[1]) throw new HttpError(400, 'photo_not_portrait');
    // normalise: PNG, at most 1024 px wide, even size (the size RunPod was tested with)
    const tmp = path.join(os.tmpdir(), `avatar-photo-${randomUUID()}.png`);
    try {
      const w = Math.min(v.width, LIMITS.photoMaxWidth) & ~1;
      await run(FFMPEG, ['-v', 'error', '-y', '-i', req.file.path, '-vf', `scale=${w}:-2:flags=lanczos`, '-frames:v', '1', tmp]);
      const out = (await probe(tmp)).video;
      const prev = profileOf(req.user.id)?.photoKey;
      const key = avatarKeys(req.user.id).photo('.png');
      await storage.put(key, tmp);
      if (prev && prev !== key) await storage.remove(prev).catch(() => undefined);
      await saveProfile(req.user.id, { photoKey: key, photoWidth: out.width, photoHeight: out.height, photoAt: new Date().toISOString() });
    } finally {
      await rm(tmp, { force: true });
    }
    res.json(publicProfile(profileOf(req.user.id)));
  }));

  app.put('/api/avatar/voice', ...guard, withUpload(LIMITS.voiceBytes, async (req, res) => {
    if (!VOICE_EXT.has(path.extname(req.file.originalname).toLowerCase())) throw new HttpError(400, 'unsupported_type');
    const info = await probe(req.file.path).catch(() => null);
    if (!info?.audio || !info.duration) throw new HttpError(400, 'invalid_file');
    const [min, max] = LIMITS.voiceSeconds;
    if (info.duration < min || info.duration > max) throw new HttpError(400, 'voice_duration');
    const tmp = path.join(os.tmpdir(), `avatar-voice-${randomUUID()}.wav`);
    try {
      await run(FFMPEG, ['-v', 'error', '-y', '-i', req.file.path, '-vn', '-ac', '1', '-ar', '24000', '-sample_fmt', 's16', tmp]);
      const key = avatarKeys(req.user.id).voice('.wav');
      await storage.put(key, tmp);
      await saveProfile(req.user.id, { voiceKey: key, voiceDuration: Math.round(info.duration * 10) / 10, voiceAt: new Date().toISOString() });
    } finally {
      await rm(tmp, { force: true });
    }
    res.json(publicProfile(profileOf(req.user.id)));
  }));

  // the photo is private: served only to its owner, with the token
  app.get('/api/avatar/photo', ...guard, wrap(async (req, res) => {
    const p = profileOf(req.user.id);
    if (!p?.photoKey) throw new HttpError(404, 'not_found');
    res.setHeader('Cache-Control', 'private, no-store');
    res.sendFile(await storage.localPath(p.photoKey));
  }));

  // ---------------------------------------------------------------- jobs
  app.post('/api/avatar/jobs', ...guard, wrap(async (req, res) => {
    needQueue();
    const text = String(req.body?.text ?? '').replace(/\s+/g, ' ').trim();
    const languages = [...new Set(Array.isArray(req.body?.languages) ? req.body.languages : [])];
    if (!text) throw new HttpError(400, 'empty_text');
    if (text.length > LIMITS.textChars) throw new HttpError(400, 'text_too_long');
    if (!languages.length || !languages.every((l) => LANGUAGES.includes(l))) throw new HttpError(400, 'invalid_languages');
    const p = profileOf(req.user.id);
    if (!p?.photoKey || !p?.voiceKey) throw new HttpError(409, 'profile_incomplete');
    const since = Date.now() - 86_400_000;
    const used = db.find('avatar_jobs', (j) => j.userId === req.user.id && new Date(j.createdAt).getTime() > since).length;
    if (used + languages.length > config.avatar.dailyLimit) throw new HttpError(429, 'daily_limit', `Limit: ${config.avatar.dailyLimit} videos per 24 h`);
    const batchId = `avb_${randomUUID()}`;
    const jobs = [];
    for (const language of languages) {
      const job = { id: `avj_${randomUUID()}`, batchId, userId: req.user.id, language, text, status: 'queued', stage: null, progress: 0, createdAt: new Date().toISOString() };
      await db.insert('avatar_jobs', job);
      jobs.push(job);
    }
    for (const j of jobs) queue.enqueue(j.id);
    res.status(201).json({ jobs: jobs.map(publicJob) });
  }));

  app.get('/api/avatar/jobs', ...guard, (req, res) => {
    const list = db.find('avatar_jobs', (j) => j.userId === req.user.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 50);
    res.json(list.map(publicJob));
  });
  app.get('/api/avatar/jobs/:id', ...guard, wrap(async (req, res) => res.json(publicJob(ownJob(req)))));

  // a failed job with a RunPod id resumes (no second payment); one without it restarts from the beginning
  app.post('/api/avatar/jobs/:id/retry', ...guard, wrap(async (req, res) => {
    needQueue();
    const j = ownJob(req);
    if (j.status !== 'failed') throw new HttpError(409, 'not_failed');
    await db.update('avatar_jobs', j.id, { status: 'queued', error: undefined, finishedAt: undefined });
    queue.enqueue(j.id);
    res.json(publicJob(db.get('avatar_jobs', j.id)));
  }));

  app.get('/api/avatar/jobs/:id/link', ...guard, wrap(async (req, res) => {
    const j = ownJob(req);
    if (j.status !== 'done') throw new HttpError(409, 'not_ready');
    const linkExpiresAt = new Date(Date.now() + limits.linkTtlMs).toISOString();
    await db.update('avatar_jobs', j.id, { linkExpiresAt });
    res.json({ url: storage.signedUrl(j.key, linkExpiresAt), expiresAt: linkExpiresAt });
  }));
}
