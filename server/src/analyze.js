import { Worker } from 'node:worker_threads';
import { limits } from './config.js';
import { probe } from './media.js';

// Beat tracking needs ~150–250 MB for a long track; a short-lived worker releases it right after,
// and the chain keeps it to one analysis at a time.
let chain = Promise.resolve();

function inWorker(file) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./analyze-worker.js', import.meta.url), { workerData: { file, beatSeconds: limits.maxVideoSeconds } });
    worker.once('message', resolve);
    worker.once('error', reject);
    worker.once('exit', (code) => code !== 0 && reject(new Error(`analysis worker exited with ${code}`)));
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
