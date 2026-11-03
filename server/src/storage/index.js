import { config } from '../config.js';
import { createLocalStorage } from './local.js';
import { createR2Storage } from './r2.js';

const local = createLocalStorage({ dataDir: config.dataDir, publicUrl: config.publicUrl, secret: config.jwtSecret });
const { r2 } = config;

/** Cloudflare R2 when all four R2_* variables are set, otherwise the local disk (development, smoke tests). */
export const storage = r2.accountId && r2.accessKeyId && r2.secretAccessKey && r2.bucket ? createR2Storage({ local, ...r2 }) : local;
export const storageDriver = storage === local ? 'local' : 'r2';

/** JSON-database mirror for db.js (R2 only; null on the local disk). `R2_DB_PREFIX` keeps dev data apart from production. */
export const dbMirror =
  storageDriver === 'r2'
    ? (() => {
        const prefix = config.r2.dbPrefix;
        return {
          list: async () => (await storage.list(prefix)).filter((k) => k.endsWith('.json')).map((k) => k.slice(prefix.length, -5)),
          get: async (name) => (await storage.getObject(`${prefix}${name}.json`))?.toString('utf8') ?? null,
          put: (name, text) => storage.putObject(`${prefix}${name}.json`, text),
        };
      })()
    : null;
