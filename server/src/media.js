import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createWriteStream, existsSync } from 'node:fs';
import { mkdir, rename, rm } from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import ffmpegPath from 'ffmpeg-static';
import ffprobeStatic from 'ffprobe-static';
import { config } from './config.js';
import { HttpError } from './errors.js';

// Node's default 250 ms per-address connect attempt is too short for some hosts (e.g. soundhelix.com).
net.setDefaultAutoSelectFamilyAttemptTimeout(2000);

export const FFMPEG = ffmpegPath;
export const FFPROBE = ffprobeStatic.path;

/** Hosts the server may download media from (library, Pexels, frontend sample files). */
const ALLOWED_HOSTS = new Set([
  'images.unsplash.com',
  'images.pexels.com',
  'videos.pexels.com',
  'player.vimeo.com',
  'www.soundhelix.com',
  'test-videos.co.uk',
  'interactive-examples.mdn.mozilla.net',
  'download.samplelib.com',
]);
const MAX_REMOTE_BYTES = 250 * 1024 * 1024;

export function run(bin, args, { onStdout, timeoutMs } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    const out = [];
    let err = '';
    child.stdout.on('data', (d) => (onStdout ? onStdout(d) : out.push(d)));
    child.stderr.on('data', (d) => {
      err = (err + d).slice(-4000);
    });
    const timer = timeoutMs ? setTimeout(() => child.kill('SIGKILL'), timeoutMs) : null;
    child.on('error', reject);
    child.on('close', (code, signal) => {
      if (timer) clearTimeout(timer);
      if (code === 0) resolve(Buffer.concat(out));
      else reject(new Error(`${path.basename(bin)} exited with ${code ?? signal}: ${err.trim().split('\n').slice(-3).join(' | ')}`));
    });
  });
}

export async function probe(file) {
  const raw = await run(FFPROBE, ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', file]);
  const data = JSON.parse(raw.toString());
  const streams = data.streams ?? [];
  const video = streams.find((s) => s.codec_type === 'video');
  const audio = streams.find((s) => s.codec_type === 'audio');
  const duration = Number(data.format?.duration ?? video?.duration ?? audio?.duration);
  return {
    duration: Number.isFinite(duration) ? duration : null,
    video: video ? { codec: video.codec_name, width: video.width, height: video.height } : null,
    audio: audio ? { codec: audio.codec_name } : null,
    formatName: data.format?.format_name ?? '',
  };
}

/** Decodes audio to mono 32-bit float PCM, streamed into one preallocated buffer. */
export function decodePcm(file, sampleRate, maxSeconds) {
  return new Promise((resolve, reject) => {
    const out = new Float32Array(Math.ceil(sampleRate * maxSeconds));
    const bytes = new Uint8Array(out.buffer);
    let offset = 0;
    let err = '';
    const child = spawn(FFMPEG, ['-v', 'error', '-i', file, '-t', String(maxSeconds), '-ac', '1', '-ar', String(sampleRate), '-f', 'f32le', 'pipe:1']);
    child.stdout.on('data', (chunk) => {
      const n = Math.min(chunk.length, bytes.length - offset);
      bytes.set(chunk.subarray(0, n), offset);
      offset += n;
    });
    child.stderr.on('data', (d) => (err = (err + d).slice(-2000)));
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) return reject(new Error(`ffmpeg decode failed: ${err.trim()}`));
      resolve(out.subarray(0, Math.floor(offset / 4)));
    });
  });
}

/** Downloads an allow-listed URL once and caches it under DATA_DIR/cache/remote. */
export async function fetchRemote(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new HttpError(400, 'invalid_url');
  }
  if (parsed.protocol !== 'https:' || !ALLOWED_HOSTS.has(parsed.hostname)) throw new HttpError(400, 'host_not_allowed', parsed.hostname);
  const dir = path.join(config.dataDir, 'cache', 'remote');
  const ext = path.extname(parsed.pathname).slice(0, 6) || '.bin';
  const file = path.join(dir, createHash('sha1').update(url).digest('hex') + ext);
  if (existsSync(file)) return file;
  await mkdir(dir, { recursive: true });
  const res = await fetch(url, { signal: AbortSignal.timeout(120_000), redirect: 'follow' });
  if (!res.ok || !res.body) throw new HttpError(502, 'remote_fetch_failed', `${res.status} ${url}`);
  if (Number(res.headers.get('content-length')) > MAX_REMOTE_BYTES) throw new HttpError(413, 'file_too_large');
  const tmp = `${file}.${process.pid}.part`;
  let bytes = 0;
  const body = Readable.fromWeb(res.body);
  body.on('data', (chunk) => {
    bytes += chunk.length;
    if (bytes > MAX_REMOTE_BYTES) body.destroy(new HttpError(413, 'file_too_large'));
  });
  try {
    await pipeline(body, createWriteStream(tmp));
    await rename(tmp, file);
  } catch (err) {
    await rm(tmp, { force: true });
    throw err;
  }
  return file;
}
