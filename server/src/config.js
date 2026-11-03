import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MAX_VIDEO_SECONDS, renderCost } from './shared/timeline.js';

const env = process.env;
const port = Number(env.PORT) || 8080;
const isProd = env.NODE_ENV === 'production' || !!env.RENDER;

let jwtSecret = env.JWT_SECRET ?? '';
if (!jwtSecret) {
  if (isProd) throw new Error('JWT_SECRET is required in production');
  jwtSecret = 'dev-only-secret';
  console.warn('[config] JWT_SECRET not set — using an insecure development secret');
}

export const config = {
  port,
  dataDir: path.resolve(env.DATA_DIR || './data'),
  jwtSecret,
  frontendOrigins: (env.FRONTEND_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim().replace(/\/+$/, ''))
    .filter(Boolean),
  pexelsKey: env.PEXELS_API_KEY || '',
  // only overridden in tests (scripts/fake-pexels.mjs)
  pexelsBase: (env.PEXELS_API_BASE || 'https://api.pexels.com').replace(/\/+$/, ''),
  // Render sets RENDER_EXTERNAL_URL automatically; PUBLIC_URL wins when both exist.
  publicUrl: (env.PUBLIC_URL || env.RENDER_EXTERNAL_URL || `http://localhost:${port}`).replace(/\/+$/, ''),
  r2: {
    accountId: env.R2_ACCOUNT_ID || '',
    accessKeyId: env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: env.R2_SECRET_ACCESS_KEY || '',
    bucket: env.R2_BUCKET || '',
    // where the JSON database is mirrored (use e.g. db-dev/ locally so development never touches production data)
    dbPrefix: (env.R2_DB_PREFIX || 'db/').replace(/^\/+/, '').replace(/\/*$/, '/'),
  },
  avatar: {
    replicateToken: env.REPLICATE_API_TOKEN || '',
    runpodKey: env.RUNPOD_API_KEY || '',
    runpodEndpoint: env.RUNPOD_ENDPOINT_ID || 'infinitetalk',
    anthropicKey: env.ANTHROPIC_API_KEY || '',
    translateModel: env.AVATAR_TRANSLATE_MODEL || 'claude-haiku-5-5',
    // the avatar is the owner's own face and voice: only these accounts may use it
    ownerEmails: (env.AVATAR_OWNER_EMAILS || '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean),
  },
  fontsDir: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../fonts'),
};

export const pricing = {
  freeCredits: 10,
  renderCost, // shared with the frontend (src/shared/timeline.js)
};

export const limits = {
  audioBytes: 20 * 1024 * 1024,
  mediaBytes: 200 * 1024 * 1024,
  depthBytes: 8 * 1024 * 1024,
  maxVideoSeconds: MAX_VIDEO_SECONDS,
  renderTimeoutMs: 20 * 60 * 1000,
  linkTtlMs: 7 * 86_400_000,
};
