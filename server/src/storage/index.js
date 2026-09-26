import { config } from '../config.js';
import { createLocalStorage } from './local.js';

/** Single storage entry point; stage 3 swaps this for an R2 driver with the same interface. */
export const storage = createLocalStorage({ dataDir: config.dataDir, publicUrl: config.publicUrl, secret: config.jwtSecret });
