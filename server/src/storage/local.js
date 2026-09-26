import { createHmac, timingSafeEqual } from 'node:crypto';
import { mkdir, rename, rm, copyFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * Local-disk storage driver (until stage 3 / Cloudflare R2).
 * Interface: put(key, srcPath), localPath(key), remove(key), publicUrl(key), signedUrl(key, expiresAt), verify(key, exp, sig).
 */
export function createLocalStorage({ dataDir, publicUrl, secret }) {
  const root = path.resolve(dataDir, 'files');
  const full = (key) => {
    const p = path.resolve(root, key);
    if (!p.startsWith(root + path.sep)) throw new Error('invalid_key');
    return p;
  };
  const sign = (key, exp) => createHmac('sha256', secret).update(`${key}:${exp}`).digest('hex');

  return {
    async put(key, srcPath) {
      const dest = full(key);
      await mkdir(path.dirname(dest), { recursive: true });
      try {
        await rename(srcPath, dest);
      } catch {
        await copyFile(srcPath, dest);
        await rm(srcPath, { force: true });
      }
      return key;
    },
    async localPath(key) {
      return full(key);
    },
    async remove(key) {
      await rm(full(key), { force: true });
    },
    publicUrl(key) {
      return `${publicUrl}/files/${key}`;
    },
    signedUrl(key, expiresAt) {
      const exp = Math.floor(new Date(expiresAt).getTime() / 1000);
      return `${publicUrl}/files/${key}?exp=${exp}&sig=${sign(key, exp)}`;
    },
    verify(key, exp, sig) {
      if (!exp || !sig || Number(exp) * 1000 < Date.now()) return false;
      const a = Buffer.from(sign(key, exp));
      const b = Buffer.from(String(sig));
      return a.length === b.length && timingSafeEqual(a, b);
    },
    filePath: full,
  };
}
