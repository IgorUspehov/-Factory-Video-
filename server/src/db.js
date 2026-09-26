import { mkdirSync, readFileSync, existsSync } from 'node:fs';
import { writeFile, rename } from 'node:fs/promises';
import path from 'node:path';

/**
 * Tiny JSON-file store: one file per collection in DATA_DIR/db, kept in memory,
 * written atomically (tmp + rename) and serialized per collection.
 */
export function createDb(dataDir) {
  const dir = path.join(dataDir, 'db');
  mkdirSync(dir, { recursive: true });
  const collections = new Map();
  const writes = new Map();

  const load = (name) => {
    if (!collections.has(name)) {
      const file = path.join(dir, `${name}.json`);
      const rows = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : [];
      collections.set(name, new Map(rows.map((r) => [r.id, r])));
    }
    return collections.get(name);
  };

  const persist = (name) => {
    const file = path.join(dir, `${name}.json`);
    const prev = writes.get(name) ?? Promise.resolve();
    const next = prev
      .catch(() => undefined)
      .then(async () => {
        const tmp = `${file}.${process.pid}.tmp`;
        await writeFile(tmp, JSON.stringify([...load(name).values()]));
        await rename(tmp, file);
      });
    writes.set(name, next);
    return next;
  };

  return {
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
    flush: () => Promise.all([...writes.values()]),
  };
}
