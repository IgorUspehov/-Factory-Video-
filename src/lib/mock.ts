import type {
  AudioAnalysis,
  BillingHistoryItem,
  Format,
  Project,
  ProjectDraft,
  RenderStatusResponse,
  User,
} from '../types';
import { projectCache, readJSON, writeJSON } from './cache';
import { libraryPhotos, libraryTracks, libraryVideos, mockRenderUrl } from './libraryData';
import { pricing, renderCost } from '../config/pricing';
import { translate, type Lang } from '../i18n';
import { uid } from './project';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

const USERS = 'fv_mock_users';
const JOBS = 'fv_mock_jobs';
const HISTORY = 'fv_mock_history';
const DAY = 86_400_000;

interface MockJob {
  jobId: string;
  projectId: string;
  email: string;
  createdAt: number;
  cost: number;
  format: Format;
  watermark: boolean;
  expiresAt: number;
}

const users = () => readJSON<Record<string, User>>(USERS, {});
const saveUser = (u: User) => writeJSON(USERS, { ...users(), [u.email]: u });

export const mockToken = (email: string) => `mock.${btoa(unescape(encodeURIComponent(email)))}`;

function emailFromToken(token: string | null): string | null {
  if (!token?.startsWith('mock.')) return null;
  try {
    return decodeURIComponent(escape(atob(token.slice(5))));
  } catch {
    return null;
  }
}

function currentUser(token: string | null): User {
  const email = emailFromToken(token);
  const u = email ? users()[email] : undefined;
  if (!u) throw new ApiError(401, 'unauthorized');
  return u;
}

function newUser(email: string): User {
  return { id: uid('usr'), email, plan: 'free', credits: pricing.free.credits, renewsAt: null };
}

/** Deterministic pseudo random generator so waveforms stay stable between reloads. */
function seeded(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

export function mockPeaks(seed: string, count = 120): number[] {
  const rnd = seeded(seed);
  return Array.from({ length: count }, (_, i) => {
    const env = 0.55 + 0.45 * Math.sin((i / count) * Math.PI);
    return Math.round((0.15 + rnd() * 0.85) * env * 100) / 100;
  });
}

function validateCredentials(body: { email?: string; password?: string }) {
  const email = (body.email ?? '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ApiError(400, 'invalid_email');
  if ((body.password ?? '').length < 6) throw new ApiError(400, 'weak_password');
  return email;
}

function jobStatus(job: MockJob): RenderStatusResponse {
  const elapsed = Date.now() - job.createdAt;
  if (elapsed < 2000) return { status: 'queued', progress: 0, url: null, expiresAt: null, watermark: job.watermark };
  const progress = Math.min(100, Math.round(((elapsed - 2000) / 12000) * 100));
  if (progress < 100) return { status: 'rendering', progress, url: null, expiresAt: null, watermark: job.watermark };
  return {
    status: 'done',
    progress: 100,
    url: `${mockRenderUrl}?job=${job.jobId}`,
    expiresAt: new Date(job.expiresAt).toISOString(),
    watermark: job.watermark,
  };
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Body = Record<string, unknown> | FormData | undefined;

export async function mockRequest<T>(method: string, fullPath: string, body: Body, token: string | null): Promise<T> {
  await delay(method === 'GET' ? 120 : 280);
  const [path, qs] = fullPath.split('?');
  const query = new URLSearchParams(qs ?? '');
  const json = (body && !(body instanceof FormData) ? body : {}) as Record<string, unknown>;
  const route = `${method} ${path}`;
  let m: RegExpMatchArray | null;

  // ---- auth
  if (route === 'POST /api/auth/register') {
    const email = validateCredentials(json as { email?: string; password?: string });
    if (users()[email]) throw new ApiError(409, 'exists');
    saveUser(newUser(email));
    return { token: mockToken(email) } as T;
  }
  if (route === 'POST /api/auth/login') {
    const email = validateCredentials(json as { email?: string; password?: string });
    if (!users()[email]) saveUser(newUser(email));
    return { token: mockToken(email) } as T;
  }
  if (route === 'POST /api/auth/logout' || route === 'POST /api/auth/forgot') return { ok: true } as T;
  if (route === 'GET /api/me') return currentUser(token) as T;

  // ---- billing (Polar checkout is simulated: the purchase is applied immediately)
  if (route === 'POST /api/billing/checkout') {
    const user = currentUser(token);
    const product = json.product === 'pro' ? 'pro' : 'credits';
    if (product === 'pro') {
      user.plan = 'pro';
      user.credits += pricing.pro.creditsPerMonth;
      user.renewsAt = new Date(Date.now() + 30 * DAY).toISOString();
    } else {
      user.credits += pricing.credits.packCredits;
    }
    saveUser(user);
    return { url: `/account?checkout=success&product=${product}` } as T;
  }
  if (route === 'GET /api/billing/portal') {
    currentUser(token);
    return { url: '/account?portal=1' } as T;
  }
  if (route === 'GET /api/billing/history') {
    const user = currentUser(token);
    const all = readJSON<(BillingHistoryItem & { email: string })[]>(HISTORY, []);
    return all
      .filter((h) => h.email === user.email)
      .map((h) => {
        const job = readJSON<MockJob[]>(JOBS, []).find((j) => j.jobId === h.id);
        return { ...h, status: job ? jobStatus(job).status : h.status };
      })
      .reverse() as T;
  }

  // ---- projects
  if (route === 'GET /api/projects') return projectCache.list() as T;
  if (route === 'POST /api/projects') {
    const now = new Date().toISOString();
    const project: Project = { ...(json as unknown as ProjectDraft), id: uid('prj'), createdAt: now, updatedAt: now };
    projectCache.put(project);
    return project as T;
  }
  if ((m = path.match(/^\/api\/projects\/([^/]+)$/))) {
    const id = decodeURIComponent(m[1]);
    const existing = projectCache.get(id);
    if (!existing) throw new ApiError(404, 'not_found');
    if (method === 'GET') return existing as T;
    if (method === 'PATCH') {
      const updated: Project = { ...existing, ...(json as Partial<Project>), id, updatedAt: new Date().toISOString() };
      projectCache.put(updated);
      return updated as T;
    }
    if (method === 'DELETE') {
      projectCache.remove(id);
      return { ok: true } as T;
    }
  }

  // ---- uploads (files stay in the browser as object URLs)
  if (route === 'POST /api/upload/audio' || route === 'POST /api/upload/media') {
    const file = body instanceof FormData ? body.get('file') : null;
    if (!(file instanceof File)) throw new ApiError(400, 'no_file');
    return { id: uid('upl'), url: URL.createObjectURL(file), name: file.name, size: file.size } as T;
  }

  // ---- audio analysis
  if (route === 'POST /api/audio/analyze') {
    const duration = Number(json.duration) || 30;
    const bpm = Number(json.bpm) || 96 + Math.round(seeded(String(json.id ?? 'x'))() * 40);
    const interval = 60 / bpm;
    const beats: number[] = [];
    for (let t = 0.2; t < duration; t += interval) beats.push(Math.round(t * 100) / 100);
    const result: AudioAnalysis = { duration, bpm, beats, peaks: mockPeaks(String(json.id ?? 'x')) };
    return result as T;
  }

  // ---- library
  if (route === 'GET /api/library/audio') {
    const mood = query.get('mood');
    const niche = query.get('niche');
    return libraryTracks.filter((t) => (!mood || t.mood === mood) && (!niche || t.niche === niche)) as T;
  }
  if (route === 'GET /api/library/media') {
    const mood = query.get('mood');
    const niche = query.get('niche');
    const kind = query.get('kind');
    return [...libraryPhotos, ...libraryVideos].filter(
      (i) => (!mood || i.mood === mood) && (!niche || i.niche === niche) && (!kind || i.kind === kind),
    ) as T;
  }

  // ---- render
  if (route === 'POST /api/render') {
    const user = currentUser(token);
    const cost = renderCost(Number(json.duration) || 15);
    if (user.credits < cost) throw new ApiError(402, 'insufficient_credits');
    user.credits -= cost;
    saveUser(user);
    const job: MockJob = {
      jobId: uid('job'),
      projectId: String(json.projectId),
      email: user.email,
      createdAt: Date.now(),
      cost,
      format: (json.format as Format) ?? '9:16',
      watermark: user.plan === 'free',
      expiresAt: Date.now() + 7 * DAY,
    };
    writeJSON(JOBS, [...readJSON<MockJob[]>(JOBS, []), job]);
    const history = readJSON<(BillingHistoryItem & { email: string })[]>(HISTORY, []);
    history.push({
      id: job.jobId,
      email: user.email,
      date: new Date().toISOString(),
      projectId: job.projectId,
      projectTitle: String(json.title ?? ''),
      format: job.format,
      credits: cost,
      status: 'queued',
    });
    writeJSON(HISTORY, history);
    return { jobId: job.jobId, cost } as T;
  }
  if ((m = path.match(/^\/api\/render\/([^/]+)(\/link)?$/)) && method === 'GET') {
    const jobs = readJSON<MockJob[]>(JOBS, []);
    const job = jobs.find((j) => j.jobId === m![1]);
    if (!job) throw new ApiError(404, 'not_found');
    if (m[2]) {
      job.expiresAt = Date.now() + 7 * DAY;
      writeJSON(JOBS, jobs);
      return { url: `${mockRenderUrl}?job=${job.jobId}&sig=${uid('s')}`, expiresAt: new Date(job.expiresAt).toISOString() } as T;
    }
    return jobStatus(job) as T;
  }

  // ---- assistant (LLM orchestrator stand-in)
  if (route === 'POST /api/assistant') {
    const lang = (['de', 'en', 'ru'].includes(String(json.lang)) ? json.lang : 'de') as Lang;
    const ctx = (json.context ?? {}) as { goal?: string; hasAudio?: boolean; mediaCount?: number; lyricsCount?: number };
    const goalTip =
      ctx.goal === 'promo'
        ? translate(lang, 'assistant.mock.promo')
        : ctx.goal === 'reels'
          ? translate(lang, 'assistant.mock.reels')
          : translate(lang, 'assistant.mock.clip');
    let next = translate(lang, 'assistant.mock.ready');
    if (!ctx.hasAudio) next = translate(lang, 'assistant.mock.addAudio');
    else if ((ctx.mediaCount ?? 0) < 3) next = translate(lang, 'assistant.mock.addVisuals');
    else if ((ctx.lyricsCount ?? 0) === 0) next = translate(lang, 'assistant.mock.addText');
    return { suggestion: `${goalTip}\n\n${next}` } as T;
  }

  throw new ApiError(404, `mock_route_missing: ${route}`);
}
