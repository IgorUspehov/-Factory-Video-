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
  fontsDir: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../fonts'),
};

export const pricing = {
  freeCredits: 10,
  renderCost, // shared with the frontend (src/shared/timeline.js)
};

export const limits = {
  audioBytes: 20 * 1024 * 1024,
  mediaBytes: 200 * 1024 * 1024,
  maxVideoSeconds: MAX_VIDEO_SECONDS,
  renderTimeoutMs: 20 * 60 * 1000,
  linkTtlMs: 7 * 86_400_000,
};
