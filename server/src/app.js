import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import { config, limits, pricing } from './config.js';
import { HttpError, wrap } from './errors.js';
import { login, publicUser, register, requireAuth } from './auth.js';
import { storage } from './storage/index.js';
import { fetchRemote, probe } from './media.js';
import { analyzeAudio } from './analyze.js';
import { listAudio, listMedia, MOODS, NICHES, ORIENTATIONS } from './library.js';
import { libraryTracks } from './libraryData.js';
import { suggest } from './assistant.js';
import { DIMENSIONS, plannedDuration } from './render/pipeline.js';

const AUDIO_EXT = new Set(['.mp3', '.wav', '.m4a']);
const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const VIDEO_EXT = new Set(['.mp4', '.mov', '.webm', '.m4v']);
const PROJECT_FIELDS = ['title', 'goal', 'format', 'mood', 'textMode', 'lengthMode', 'nodes', 'edges', 'audio', 'media', 'lyrics', 'style', 'timeline', 'render'];

const pick = (obj, keys) => Object.fromEntries(keys.filter((k) => obj?.[k] !== undefined).map((k) => [k, obj[k]]));
const publicProject = ({ userId: _u, ...p }) => p;
const validLengthMode = (m) => m === 'track' || m === 'timeline' || (typeof m === 'number' && m > 0 && m <= limits.maxVideoSeconds);

export function createApp({ db, queue }) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(
    cors({
      origin: (origin, cb) => cb(null, !origin || config.frontendOrigins.includes(origin)),
      allowedHeaders: ['Authorization', 'Content-Type', 'Accept'],
      methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    }),
  );
  app.use(express.json({ limit: '15mb' }));

  const auth = requireAuth(db);
  const tmpDir = path.join(config.dataDir, 'tmp', 'uploads');
  mkdirSync(tmpDir, { recursive: true });
  const upload = (maxBytes) =>
    multer({ dest: tmpDir, limits: { fileSize: maxBytes, files: 1, fields: 5 } }).single('file');

  // ---------------------------------------------------------------- health
  app.get('/api/health', (_req, res) => res.json({ ok: true, queue: queue.size() }));

  // ---------------------------------------------------------------- auth
  app.post('/api/auth/register', wrap(async (req, res) => res.status(201).json(await register(db, req.body))));
  app.post('/api/auth/login', wrap(async (req, res) => res.json(await login(db, req.body))));
  // JWTs are stateless: logout is handled by the client dropping the token.
  app.post('/api/auth/logout', (_req, res) => res.json({ ok: true }));
  app.post('/api/auth/forgot', (_req, res) => res.status(202).json({ ok: true }));
  app.get('/api/me', auth, (req, res) => res.json(publicUser(req.user)));

  // ---------------------------------------------------------------- billing (stage 4)
  const notYet = (_req, res) =>
    res.status(501).json({ error: 'billing_not_implemented', message: 'Billing via Polar is planned for stage 4.' });
  app.post('/api/billing/checkout', auth, notYet);
  app.get('/api/billing/portal', auth, notYet);
  app.get('/api/billing/history', auth, (req, res) => {
    const jobs = db.find('jobs', (j) => j.userId === req.user.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    res.json(
      jobs.map((j) => ({
        id: j.id,
        date: j.createdAt,
        projectId: j.projectId,
        projectTitle: j.projectTitle,
        format: j.format,
        credits: j.refunded ? 0 : j.cost,
        status: j.status,
      })),
    );
  });

  // ---------------------------------------------------------------- projects
  const ownProject = (req) => {
    const p = db.get('projects', req.params.id);
    if (!p || p.userId !== req.user.id) throw new HttpError(404, 'not_found');
    return p;
  };
  app.get('/api/projects', auth, (req, res) => {
    const list = db.find('projects', (p) => p.userId === req.user.id).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    res.json(list.map(publicProject));
  });
  app.post('/api/projects', auth, wrap(async (req, res) => {
    const draft = pick(req.body, PROJECT_FIELDS);
    if (typeof draft.title !== 'string' || !DIMENSIONS[draft.format]) throw new HttpError(400, 'invalid_project');
    if (draft.lengthMode !== undefined && !validLengthMode(draft.lengthMode)) throw new HttpError(400, 'invalid_length_mode');
    const now = new Date().toISOString();
    const project = { ...draft, id: `prj_${randomUUID()}`, userId: req.user.id, createdAt: now, updatedAt: now };
    await db.insert('projects', project);
    res.status(201).json(publicProject(project));
  }));
  app.get('/api/projects/:id', auth, wrap(async (req, res) => res.json(publicProject(ownProject(req)))));
  app.patch('/api/projects/:id', auth, wrap(async (req, res) => {
    const p = ownProject(req);
    const patch = pick(req.body, PROJECT_FIELDS);
    if (patch.format && !DIMENSIONS[patch.format]) throw new HttpError(400, 'invalid_format');
    if (patch.lengthMode !== undefined && !validLengthMode(patch.lengthMode)) throw new HttpError(400, 'invalid_length_mode');
    res.json(publicProject(await db.update('projects', p.id, { ...patch, updatedAt: new Date().toISOString() })));
  }));
  app.delete('/api/projects/:id', auth, wrap(async (req, res) => {
    await db.remove('projects', ownProject(req).id);
    res.json({ ok: true });
  }));

  // ---------------------------------------------------------------- uploads
  async function storeUpload(req, kind, info) {
    const id = `upl_${randomUUID()}`;
    const ext = path.extname(req.file.originalname).toLowerCase();
    const key = `uploads/${req.user.id}/${id}${ext}`;
    await storage.put(key, req.file.path);
    const row = {
      id,
      userId: req.user.id,
      kind,
      key,
      name: req.file.originalname,
      size: req.file.size,
      mime: req.file.mimetype,
      duration: info.duration,
      rightsConfirmed: kind === 'audio' ? true : undefined,
      createdAt: new Date().toISOString(),
    };
    await db.insert('uploads', row);
    return { id, url: storage.publicUrl(key), name: row.name, size: row.size };
  }

  const withUpload = (maxBytes, handler) =>
    wrap(async (req, res) => {
      await new Promise((resolve, reject) =>
        upload(maxBytes)(req, res, (err) => {
          if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') reject(new HttpError(413, 'file_too_large'));
          else if (err) reject(new HttpError(400, 'invalid_upload', err.message));
          else resolve();
        }),
      );
      if (!req.file) throw new HttpError(400, 'no_file');
      try {
        await handler(req, res);
      } finally {
        await rm(req.file.path, { force: true });
      }
    });

  app.post('/api/upload/audio', auth, withUpload(limits.audioBytes, async (req, res) => {
    if (String(req.body?.rightsConfirmed) !== 'true') throw new HttpError(400, 'rights_not_confirmed');
    if (!AUDIO_EXT.has(path.extname(req.file.originalname).toLowerCase())) throw new HttpError(400, 'unsupported_type');
    const info = await probe(req.file.path).catch(() => null);
    if (!info?.audio || !info.duration) throw new HttpError(400, 'invalid_file');
    res.status(201).json(await storeUpload(req, 'audio', info));
  }));

  app.post('/api/upload/media', auth, withUpload(limits.mediaBytes, async (req, res) => {
    const ext = path.extname(req.file.originalname).toLowerCase();
    const kind = IMAGE_EXT.has(ext) ? 'image' : VIDEO_EXT.has(ext) ? 'video' : null;
    if (!kind) throw new HttpError(400, 'unsupported_type');
    const info = await probe(req.file.path).catch(() => null);
    if (!info?.video || (kind === 'video' && !info.duration)) throw new HttpError(400, 'invalid_file');
    res.status(201).json(await storeUpload(req, kind, info));
  }));

  // Depth map (PNG, from the browser model) for 2.5D parallax; referenced from the media item as `depth.id`.
  app.post('/api/upload/depth', auth, withUpload(limits.depthBytes, async (req, res) => {
    if (path.extname(req.file.originalname).toLowerCase() !== '.png') throw new HttpError(400, 'unsupported_type');
    const info = await probe(req.file.path).catch(() => null);
    const v = info?.video;
    if (!v || v.codec !== 'png' || v.width > 2048 || v.height > 2048) throw new HttpError(400, 'invalid_file');
    res.status(201).json(await storeUpload(req, 'depth', info));
  }));

  // ---------------------------------------------------------------- audio analysis
  app.post('/api/audio/analyze', auth, wrap(async (req, res) => {
    const id = String(req.body?.id ?? '');
    const up = db.get('uploads', id);
    let file;
    let cacheId;
    if (up && up.userId === req.user.id && up.kind === 'audio') {
      file = await storage.localPath(up.key);
      cacheId = up.id;
    } else {
      const track = libraryTracks.find((t) => t.id === id);
      if (!track) throw new HttpError(404, 'not_found');
      file = await fetchRemote(track.url);
      cacheId = `lib:${track.id}`;
    }
    let cached = db.get('analyses', cacheId);
    if (!cached) {
      cached = { id: cacheId, ...(await analyzeAudio(file)), createdAt: new Date().toISOString() };
      await db.insert('analyses', cached);
    }
    const { duration, bpm, beats, peaks } = cached;
    res.json({ duration, bpm, beats, peaks });
  }));

  // ---------------------------------------------------------------- library
  const filterParam = (value, allowed) => (allowed.includes(value) ? value : undefined);
  app.get('/api/library/audio', auth, (req, res) =>
    res.json(listAudio({ mood: filterParam(req.query.mood, MOODS), niche: filterParam(req.query.niche, NICHES) })),
  );
  app.get('/api/library/media', auth, wrap(async (req, res) => {
    const page = Math.min(50, Math.max(1, Number.parseInt(String(req.query.page ?? '1'), 10) || 1));
    const { items, source } = await listMedia({
      q: typeof req.query.q === 'string' ? req.query.q : '',
      mood: filterParam(req.query.mood, MOODS),
      niche: filterParam(req.query.niche, NICHES),
      kind: filterParam(req.query.kind, ['image', 'video']),
      orientation: filterParam(req.query.orientation, ORIENTATIONS),
      lang: filterParam(req.query.lang, ['de', 'en', 'ru']),
      page,
    });
    res.set('X-Library-Source', source).json(items);
  }));

  // ---------------------------------------------------------------- render
  const ownJob = (req) => {
    const job = db.get('jobs', req.params.jobId);
    if (!job || job.userId !== req.user.id) throw new HttpError(404, 'not_found');
    return job;
  };
  const jobStatus = (job) => {
    const done = job.status === 'done' && job.key;
    return {
      status: job.status,
      progress: done ? 100 : job.status === 'queued' ? 0 : job.progress ?? 0,
      url: done ? storage.signedUrl(job.key, job.linkExpiresAt) : null,
      expiresAt: done ? job.linkExpiresAt : null,
      watermark: job.watermark,
    };
  };

  app.post('/api/render', auth, wrap(async (req, res) => {
    const project = db.get('projects', String(req.body?.projectId ?? ''));
    if (!project || project.userId !== req.user.id) throw new HttpError(404, 'not_found');
    const format = DIMENSIONS[req.body?.format] ? req.body.format : project.format;
    const duration = plannedDuration(project);
    if (!(duration > 0)) throw new HttpError(400, 'empty_project');
    if (duration > limits.maxVideoSeconds) throw new HttpError(400, 'too_long');
    const cost = pricing.renderCost(duration);
    const user = req.user;
    if (user.credits < cost) throw new HttpError(402, 'insufficient_credits');
    await db.update('users', user.id, { credits: user.credits - cost });
    const job = {
      id: `job_${randomUUID()}`,
      userId: user.id,
      projectId: project.id,
      projectTitle: project.title,
      format,
      cost,
      watermark: user.plan !== 'pro',
      status: 'queued',
      progress: 0,
      createdAt: new Date().toISOString(),
      snapshot: publicProject(project),
    };
    await db.insert('jobs', job);
    queue.enqueue(job.id);
    res.status(201).json({ jobId: job.id, cost });
  }));
  app.get('/api/render/:jobId', auth, wrap(async (req, res) => res.json(jobStatus(ownJob(req)))));
  app.get('/api/render/:jobId/link', auth, wrap(async (req, res) => {
    const job = ownJob(req);
    if (job.status !== 'done') throw new HttpError(409, 'not_ready');
    await db.update('jobs', job.id, { linkExpiresAt: new Date(Date.now() + limits.linkTtlMs).toISOString() });
    res.json({ url: storage.signedUrl(job.key, job.linkExpiresAt), expiresAt: job.linkExpiresAt });
  }));

  // ---------------------------------------------------------------- assistant
  app.post('/api/assistant', auth, (req, res) => {
    const project = db.get('projects', String(req.body?.projectId ?? ''));
    const own = project && project.userId === req.user.id ? project : null;
    res.json({ suggestion: suggest({ lang: String(req.body?.lang ?? 'de'), project: own, context: req.body?.context }) });
  });

  // ---------------------------------------------------------------- files
  // uploads/ keys are unguessable UUID paths; renders/ need a valid, unexpired signature.
  app.get(/^\/files\/(.+)$/, (req, res, next) => {
    const key = req.params[0];
    if (!/^(uploads|renders)\/[\w-]+\/[\w-]+\.\w+$/.test(key)) return next(new HttpError(404, 'not_found'));
    if (key.startsWith('renders/') && !storage.verify(key, req.query.exp, req.query.sig)) return next(new HttpError(403, 'link_expired'));
    if (req.query.download === '1') res.attachment(path.basename(key));
    res.sendFile(storage.filePath(key), { maxAge: key.startsWith('renders/') ? 0 : '7d' }, (err) => {
      if (err && !res.headersSent) next(new HttpError(404, 'not_found'));
    });
  });

  // ---------------------------------------------------------------- errors
  app.use('/api', (_req, _res, next) => next(new HttpError(404, 'not_found')));
  app.use((err, _req, res, _next) => {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.code, message: err.message });
    if (err?.type === 'entity.too.large') return res.status(413).json({ error: 'payload_too_large' });
    if (err instanceof SyntaxError && 'body' in err) return res.status(400).json({ error: 'invalid_json' });
    console.error('[api]', err);
    res.status(500).json({ error: 'internal_error' });
  });

  return app;
}
