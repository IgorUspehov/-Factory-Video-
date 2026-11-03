import { config } from '../config.js';
import { createLocalStorage } from './local.js';
import { createR2Storage } from './r2.js';

const local = createLocalStorage({ dataDir: config.dataDir, publicUrl: config.publicUrl, secret: config.jwtSecret });
const { r2 } = config;

/** Cloudflare R2 when all four R2_* variables are set, otherwise the local disk (development, smoke tests). */
export const storage = r2.accountId && r2.accessKeyId && r2.secretAccessKey && r2.bucket ? createR2Storage({ local, ...r2 }) : local;
export const storageDriver = storage === local ? 'local' : 'r2';
