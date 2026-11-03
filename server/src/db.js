import { mkdirSync, readFileSync, existsSync } from 'node:fs';
import { readFile, readdir, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';

const MIRROR_INTERVAL_MS = 3000;

/**
 * Tiny JSON-file store: one file per collection in DATA_DIR/db, kept in memory,
 * written atomically (tmp + rename) and serialized per collection.
 *
 * Optional `mirror` ({ list(), get(name), put(name, text) } — see storage/r2.js): Render's disk is wiped on every
 * deploy, so each collection is also copied to R2. Local writes stay synchronous-fast; the upload runs in the
 * background (coalesced, at most one per MIRROR_INTERVAL_MS per collection, always the latest snapshot).
 * `hydrate()` must run once before the first use: it makes R2 the source of truth for existing collections.
 */
export function createDb(dataDir, mirror = null) {
  const dir = path.join(dataDir, 'db');
  mkdirSync(dir, { recursive: true });
  const collections = new Map();
  const writes = new Map();
  const mirrorState = new Map(); // name -> { text, timer, running, lastAt, dirty }

  const fileOf = (name) => path.join(dir, `${name}.json`);

  const load = (name) => {
    if (!collections.has(name)) {
      const file = fileOf(name);
      const rows = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : [];
      collections.set(name, new Map(rows.map((r) => [r.id, r])));
    }
    return collections.get(name);
  };

  // ---- R2 mirror
  const mirrorUpload = async (name) => {
    const st = mirrorState.get(name);
    if (!st || st.running || !st.dirty) return;
    st.running = true;
    st.timer = null;
    try {
      while (st.dirty) {
        st.dirty = false;
        const text = st.text;
        try {
          await mirror.put(name, text);
          st.lastAt = Date.now();
        } catch (err) {
          st.dirty = true; // retried by the next write or flush
          console.error(`[db] mirror upload of "${name}" failed:`, err.name, err.message);
          break;
        }
      }
    } finally {
      st.running = false;
    }
  };

  const scheduleMirror = (name, text) => {
    if (!mirror) return;
    const st = mirrorState.get(name) ?? { text, timer: null, running: false, lastAt: 0, dirty: false };
    mirrorState.set(name, st);
    st.text = text;
    st.dirty = true;
    if (st.running || st.timer) return;
    const wait = Math.max(0, st.lastAt + MIRROR_INTERVAL_MS - Date.now());
    st.timer = setTimeout(() => void mirrorUpload(name), wait);
  };

  const persist = (name) => {
    const file = fileOf(name);
    const prev = writes.get(name) ?? Promise.resolve();
    const next = prev
      .catch(() => undefined)
      .then(async () => {
        const tmp = `${file}.${process.pid}.tmp`;
        const text = JSON.stringify([...load(name).values()]);
        await writeFile(tmp, text);
        await rename(tmp, file);
        scheduleMirror(name, text);
      });
    writes.set(name, next);
    return next;
  };

  const flushMirror = async () => {
    for (const [name, st] of mirrorState) {
      if (st.timer) {
        clearTimeout(st.timer);
        st.timer = null;
      }
      while (st.running) await new Promise((r) => setTimeout(r, 25));
      await mirrorUpload(name);
    }
  };

  return {
    /** R2 -> local. Collections only present locally (first run after enabling the mirror) are uploaded. */
    async hydrate() {
      if (!mirror) return { downloaded: 0, uploaded: 0 };
      let downloaded = 0;
      let uploaded = 0;
      const remote = new Set(await mirror.list());
      for (const name of remote) {
        const text = await mirror.get(name);
        if (text == null) continue;
        JSON.parse(text); // refuse to adopt a corrupt snapshot
        await writeFile(fileOf(name), text);
        collections.delete(name);
        downloaded++;
      }
      for (const f of await readdir(dir)) {
        const m = /^([\w-]+)\.json$/.exec(f);
        if (m && !remote.has(m[1])) {
          await mirror.put(m[1], await readFile(path.join(dir, f), 'utf8'));
          uploaded++;
        }
      }
      return { downloaded, uploaded };
    },
    get: (name, id) => load(name).get(id),
    find: (name, pred) => [...load(name).values()].filter(pred),
    findOne: (name, pred) => [...load(name).values()].find(pred),
    async insert(name, row) {
      load(name).set(row.id, row);
      await persist(name);
      return row;
    },
    async update(name, id, patch) {
      const row = load(name).get(id);
      if (!row) return undefined;
      Object.assign(row, patch);
      await persist(name);
      return row;
    },
    async remove(name, id) {
      load(name).delete(id);
      await persist(name);
    },
    async flush() {
      await Promise.all([...writes.values()]);
      await flushMirror();
    },
  };
}
