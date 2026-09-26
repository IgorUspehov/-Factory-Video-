import { parentPort, workerData } from 'node:worker_threads';
import MusicTempo from 'music-tempo';
import { decodePcm } from './media.js';

// Parameters picked on synthetic 75–160 BPM tracks: 22.05 kHz / hop 221 / FFT 1024 was the most stable set.
const RATE = 22050;
const HOP = 221;
const FOLD_ABOVE = 160;
const PEAKS = 120;

function peaks(pcm, count) {
  const block = Math.max(1, Math.floor(pcm.length / count));
  const out = [];
  for (let i = 0; i < count; i++) {
    let max = 0;
    const end = Math.min(pcm.length, (i + 1) * block);
    for (let j = i * block; j < end; j += 8) max = Math.max(max, Math.abs(pcm[j]));
    out.push(max);
  }
  const top = Math.max(...out, 0.01);
  return out.map((p) => Math.round((p / top) * 100) / 100);
}

/** Energy of ±20 ms around a beat. */
function energyAt(pcm, t) {
  const c = Math.round(t * RATE);
  const w = Math.round(0.02 * RATE);
  let e = 0;
  for (let i = Math.max(0, c - w); i < Math.min(pcm.length, c + w); i++) e += pcm[i] * pcm[i];
  return e;
}

/**
 * music-tempo tends to lock onto double time for slow tracks (75 → 150 BPM in tests).
 * Above FOLD_ABOVE the tempo is halved and the beat parity with more energy (usually the kick) is kept.
 */
function foldOctave(bpm, beats, pcm) {
  if (bpm <= FOLD_ABOVE || beats.length < 4) return { bpm, beats };
  const mean = (arr) => arr.reduce((s, t) => s + energyAt(pcm, t), 0) / Math.max(1, arr.length);
  const even = beats.filter((_, i) => i % 2 === 0);
  const odd = beats.filter((_, i) => i % 2 === 1);
  return { bpm: Math.round((bpm / 2) * 10) / 10, beats: mean(even) >= mean(odd) ? even : odd };
}

const { file, beatSeconds } = workerData;
// peaks span the whole track (up to 10 min) because the frontend draws them over its full duration
const pcm = await decodePcm(file, RATE, 600);
let bpm = 0;
let beats = [];
try {
  const mt = new MusicTempo(pcm.subarray(0, RATE * beatSeconds), { bufferSize: 1024, hopSize: HOP, timeStep: HOP / RATE });
  ({ bpm, beats } = foldOctave(Math.round(Number(mt.tempo) * 10) / 10, mt.beats, pcm));
  beats = beats.map((b) => Math.round(b * 100) / 100);
} catch {
  /* music-tempo throws on silence / too few onsets — no beats then */
}
parentPort.postMessage({ bpm: bpm > 0 ? bpm : 0, beats, peaks: peaks(pcm, PEAKS), samples: pcm.length / RATE });
