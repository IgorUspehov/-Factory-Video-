import { config } from './config.js';
import { createDb } from './db.js';
import { createRenderQueue } from './render/queue.js';
import { createApp } from './app.js';

const db = createDb(config.dataDir);
const queue = createRenderQueue(db);
const app = createApp({ db, queue });

const server = app.listen(config.port, () => {
  console.log(`[server] Factory Video API on :${config.port} · data ${config.dataDir} · public ${config.publicUrl}`);
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
