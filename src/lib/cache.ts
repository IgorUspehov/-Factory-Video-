import type { Project } from '../types';

const KEY = 'fv_projects';

export function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeJSON(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota exceeded or storage disabled — cache is best effort */
  }
}

/** Local project cache: lets the app keep working when the backend is unreachable. */
export const projectCache = {
  all(): Record<string, Project> {
    return readJSON<Record<string, Project>>(KEY, {});
  },
  list(): Project[] {
    return Object.values(this.all()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },
  get(id: string): Project | undefined {
    return this.all()[id];
  },
  put(p: Project): void {
    writeJSON(KEY, { ...this.all(), [p.id]: p });
  },
  putMany(list: Project[]): void {
    const all = this.all();
    for (const p of list) all[p.id] = p;
    writeJSON(KEY, all);
  },
  remove(id: string): void {
    const all = this.all();
    delete all[id];
    writeJSON(KEY, all);
  },
};
