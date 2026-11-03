import { config } from './config.js';
import { createDb } from './db.js';
import { createRenderQueue } from './render/queue.js';
import { createApp } from './app.js';
import path from 'node:path';
import { createAvatarQueue } from './avatar/queue.js';
import { createReplicate } from './avatar/providers/replicate.js';
import { createRunpod } from './avatar/providers/runpod.js';
import { createTranslator } from './avatar/providers/translate.js';
import { dbMirror, storage, storageDriver } from './storage/index.js';

const db = createDb(config.dataDir, dbMirror);
const hydrated = await db.hydrate();
if (dbMirror) console.log(`[db] mirror ${config.r2.dbPrefix}: ${hydrated.downloaded} collection(s) restored from R2, ${hydrated.uploaded} uploaded`);
const queue = createRenderQueue(db);
// avatar block: only when every provider key is present (otherwise its routes answer 503)
const av = config.avatar;
const avatarQueue =
  av.replicateToken && av.runpodKey && av.anthropicKey
    ? createAvatarQueue({
        db,
        storage,
        workRoot: path.join(config.dataDir, 'tmp', 'avatar'),
        translator: createTranslator({ apiKey: av.anthropicKey, model: av.translateModel }),
        tts: createReplicate({ token: av.replicateToken }),
        talk: createRunpod({ apiKey: av.runpodKey, endpoint: av.runpodEndpoint }),
      })
    : null;
const app = createApp({ db, queue, avatarQueue });

const server = app.listen(config.port, () => {
  console.log(`[server] Factory Video API on :${config.port} · data ${config.dataDir} · public ${config.publicUrl} · storage ${storageDriver}`);
  console.log(`[server] CORS origins: ${config.frontendOrigins.join(', ')} · Pexels: ${config.pexelsKey ? 'on' : 'off (static library)'}`);
  queue.recover();
  avatarQueue?.recover();
  console.log(`[server] Avatar: ${avatarQueue ? `on, ${av.ownerEmails.length} owner account(s)` : 'off (provider keys missing)'}`);
});

async function shutdown(signal) {
  console.log(`[server] ${signal}, shutting down`);
  server.close();
  await db.flush();
  process.exit(0);
}
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
