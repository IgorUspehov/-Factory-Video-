// Shared helpers for the avatar probe scripts. No dependencies (Node >= 22: global fetch).
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function need(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing env ${name}`);
    process.exit(2);
  }
  return v;
}

export function args(argv = process.argv.slice(2)) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const k = argv[i].slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) out[k] = true;
      else out[k] = argv[++i];
    } else out._.push(argv[i]);
  }
  return out;
}

const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.ogg': 'audio/ogg' };

/** http(s) URL stays as is; a local path becomes a data: URI. */
export async function fileOrUrl(v) {
  if (/^https?:\/\//i.test(v)) return v;
  const buf = await readFile(v);
  return `data:${MIME[path.extname(v).toLowerCase()] ?? 'application/octet-stream'};base64,${buf.toString('base64')}`;
}

/** fetch with retries on network errors. POST is retried only when the TCP connection was never established (request not sent). */
export async function fetchRetry(url, opts = {}, tries = 6) {
  for (let i = 1; ; i++) {
    try {
      return await fetch(url, opts);
    } catch (err) {
      const connectFailed = (err.cause?.errors ?? [err.cause]).every((e) => e?.syscall === 'connect');
      const safe = (opts.method ?? 'GET') === 'GET' || connectFailed;
      if (!safe || i >= tries) throw err;
      console.warn(`\n  network error (${err.cause?.code ?? err.message}), retry ${i}/${tries - 1}`);
      await sleep(3000 * i);
    }
  }
}

export async function json(url, opts = {}) {
  const res = await fetchRetry(url, opts);
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  if (!res.ok) throw new Error(`${opts.method ?? 'GET'} ${url} -> ${res.status}: ${typeof body === 'string' ? body.slice(0, 500) : JSON.stringify(body).slice(0, 500)}`);
  return body;
}

export async function download(url, dest) {
  await mkdir(path.dirname(dest), { recursive: true });
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(dest, buf);
  return buf.length;
}

export const secs = (t0) => ((Date.now() - t0) / 1000).toFixed(1);
