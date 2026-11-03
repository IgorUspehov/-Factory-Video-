import { config } from './config.js';
import { createDb } from './db.js';
import { createRenderQueue } from './render/queue.js';
import { createApp } from './app.js';
import { dbMirror, storageDriver } from './storage/index.js';

const db = createDb(config.dataDir, dbMirror);
const hydrated = await db.hydrate();
if (dbMirror) console.log(`[db] mirror ${config.r2.dbPrefix}: ${hydrated.downloaded} collection(s) restored from R2, ${hydrated.uploaded} uploaded`);
const queue = createRenderQueue(db);
const app = createApp({ db, queue });

const server = app.listen(config.port, () => {
  console.log(`[server] Factory Video API on :${config.port} · data ${config.dataDir} · public ${config.publicUrl} · storage ${storageDriver}`);
  console.log(`[server] CORS origins: ${config.frontendOrigins.join(', ')} · Pexels: ${config.pexelsKey ? 'on' : 'off (static library)'}`);
  queue.recover();
});

async function shutdown(signal) {
  console.log(`[server] ${signal}, shutting down`);
  server.close();
  await db.flush();
  process.exit(0);
}
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
