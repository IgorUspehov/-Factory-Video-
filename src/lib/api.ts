import type {
  AudioAnalysis,
  BillingHistoryItem,
  Format,
  LibraryMedia,
  LibraryTrack,
  Project,
  ProjectDraft,
  RenderJob,
  RenderStatusResponse,
  UploadResult,
  User,
} from '../types';
import { projectCache } from './cache';
import { ApiError, mockRequest } from './mock';

export { ApiError };

const BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '');
const TOKEN_KEY = 'fv_token';

export const tokenStore = {
  get(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set(token: string) {
    localStorage.setItem(TOKEN_KEY, token);
  },
  clear() {
    localStorage.removeItem(TOKEN_KEY);
  },
};

/** True when no backend is configured or it turned out to be unreachable. */
let useMocks = !BASE;
export const isMockMode = () => useMocks;

type Body = Record<string, unknown> | FormData | undefined;

async function request<T>(method: string, path: string, body?: Body): Promise<T> {
  const token = tokenStore.get();
  if (!useMocks) {
    try {
      const headers: Record<string, string> = { Accept: 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;
      let payload: BodyInit | undefined;
      if (body instanceof FormData) payload = body;
      else if (body !== undefined) {
        headers['Content-Type'] = 'application/json';
        payload = JSON.stringify(body);
      }
      const res = await fetch(`${BASE}${path}`, { method, headers, body: payload });
      if ([502, 503, 504].includes(res.status)) throw new TypeError('backend_unavailable');
      if (!res.ok) {
        let message = res.statusText;
        try {
          const data = await res.json();
          message = data.error ?? data.message ?? message;
        } catch {
          /* non-JSON error body */
        }
        throw new ApiError(res.status, message);
      }
      if (res.status === 204) return undefined as T;
      return (await res.json()) as T;
    } catch (err) {
      if (err instanceof ApiError) throw err;
      useMocks = true;
      console.warn('[api] backend unreachable, switching to local mocks', err);
    }
  }
  return mockRequest<T>(method, path, body, token);
}

const qs = (params: Record<string, string | undefined>) => {
  const s = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]).toString();
  return s ? `?${s}` : '';
};

const withFile = (file: File) => {
  const fd = new FormData();
  fd.append('file', file);
  return fd;
};

export const api = {
  // auth
  register: (email: string, password: string) => request<{ token: string }>('POST', '/api/auth/register', { email, password }),
  login: (email: string, password: string) => request<{ token: string }>('POST', '/api/auth/login', { email, password }),
  logout: () => request<unknown>('POST', '/api/auth/logout'),
  forgotPassword: (email: string) => request<unknown>('POST', '/api/auth/forgot', { email }),
  me: () => request<User>('GET', '/api/me'),

  // billing (Polar)
  checkout: (product: 'pro' | 'credits') => request<{ url: string }>('POST', '/api/billing/checkout', { product }),
  portal: () => request<{ url: string }>('GET', '/api/billing/portal'),
  billingHistory: () => request<BillingHistoryItem[]>('GET', '/api/billing/history'),

  // projects (cached locally so the editor keeps working offline)
  async listProjects(): Promise<Project[]> {
    try {
      const list = await request<Project[]>('GET', '/api/projects');
      projectCache.putMany(list);
      return list;
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) throw err;
      return projectCache.list();
    }
  },
  async createProject(draft: ProjectDraft): Promise<Project> {
    const p = await request<Project>('POST', '/api/projects', draft as unknown as Record<string, unknown>);
    projectCache.put(p);
    return p;
  },
  async getProject(id: string): Promise<Project> {
    try {
      const p = await request<Project>('GET', `/api/projects/${encodeURIComponent(id)}`);
      projectCache.put(p);
      return p;
    } catch (err) {
      const cached = projectCache.get(id);
      if (cached && !(err instanceof ApiError && err.status === 404)) return cached;
      throw err;
    }
  },
  async updateProject(id: string, patch: Partial<Project>): Promise<Project> {
    const cached = projectCache.get(id);
    if (cached) projectCache.put({ ...cached, ...patch, updatedAt: new Date().toISOString() });
    const p = await request<Project>('PATCH', `/api/projects/${encodeURIComponent(id)}`, patch as Record<string, unknown>);
    projectCache.put(p);
    return p;
  },
  async deleteProject(id: string): Promise<void> {
    await request<unknown>('DELETE', `/api/projects/${encodeURIComponent(id)}`);
    projectCache.remove(id);
  },

  // uploads
  uploadAudio: (file: File) => request<UploadResult>('POST', '/api/upload/audio', withFile(file)),
  uploadMedia: (file: File) => request<UploadResult>('POST', '/api/upload/media', withFile(file)),
  analyzeAudio: (body: { id: string; url?: string; duration?: number; bpm?: number }) =>
    request<AudioAnalysis>('POST', '/api/audio/analyze', body),

  // library
  libraryAudio: (mood?: string, niche?: string) => request<LibraryTrack[]>('GET', `/api/library/audio${qs({ mood, niche })}`),
  libraryMedia: (params: { mood?: string; niche?: string; kind?: string } = {}) =>
    request<LibraryMedia[]>('GET', `/api/library/media${qs(params)}`),

  // render
  startRender: (body: { projectId: string; title: string; format: Format; duration: number }) =>
    request<RenderJob>('POST', '/api/render', body),
  renderStatus: (jobId: string) => request<RenderStatusResponse>('GET', `/api/render/${encodeURIComponent(jobId)}`),
  renderLink: (jobId: string) => request<{ url: string; expiresAt: string }>('GET', `/api/render/${encodeURIComponent(jobId)}/link`),

  // assistant (LLM orchestrator: suggests block order and copy)
  assistant: (body: { projectId: string; message: string; lang: string; context: Record<string, unknown> }) =>
    request<{ suggestion: string }>('POST', '/api/assistant', body),
};
