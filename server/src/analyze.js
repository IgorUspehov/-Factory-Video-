import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { limits } from './config.js';
import { probe } from './media.js';

// Beat tracking needs ~150–250 MB for a long track. It runs in a short-lived child process, so that memory
// goes back to the OS when it exits (a worker thread left it in the server process); one analysis at a time.
let chain = Promise.resolve();

const WORKER = fileURLToPath(new URL('./analyze-worker.js', import.meta.url));

function inWorker(file) {
  return new Promise((resolve, reject) => {
    execFile(process.execPath, [WORKER, file, String(limits.maxVideoSeconds)], { maxBuffer: 16 * 1024 * 1024, timeout: 120_000 }, (err, stdout) => {
      if (err) return reject(new Error(`analysis failed: ${err.message}`));
      try {
        resolve(JSON.parse(stdout));
      } catch (e) {
        reject(e);
      }
    });
  });
}

/** Returns { duration, bpm, beats[], peaks[] }. Beats cover the first limits.maxVideoSeconds (max. video length). */
export function analyzeAudio(file) {
  const job = chain.then(async () => {
    const info = await probe(file);
    if (!info.audio) throw new Error('no_audio_stream');
    const r = await inWorker(file);
    return { duration: Math.round((info.duration ?? r.samples) * 100) / 100, bpm: r.bpm, beats: r.beats, peaks: r.peaks };
  });
  chain = job.catch(() => undefined);
  return job;
}
