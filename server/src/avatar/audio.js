import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { FFMPEG, probe, run } from '../media.js';

/** Joins TTS chunks (any WAV) into one 24 kHz mono 16-bit WAV in the given order. */
export async function concatWav(files, out, timeoutMs = 120_000) {
  const inputs = files.flatMap((f) => ['-i', f]);
  const filter = `${files.map((_, i) => `[${i}:a]`).join('')}concat=n=${files.length}:v=0:a=1,aresample=24000,aformat=sample_fmts=s16:channel_layouts=mono[a]`;
  await run(FFMPEG, ['-hide_banner', '-v', 'error', '-y', ...inputs, '-filter_complex', filter, '-map', '[a]', out], { timeoutMs });
  return out;
}

const execFileP = promisify(execFile);

/**
 * Where the speech in a recording starts and ends (ffmpeg silencedetect). Only leading and trailing silence counts;
 * pauses inside the speech stay. A recording that is silent throughout throws `recording_silent`.
 */
export async function speechSpan(file, { noiseDb = -35, minSilence = 0.3 } = {}) {
  const [{ stderr }, info] = await Promise.all([
    execFileP(FFMPEG, ['-hide_banner', '-nostats', '-i', file, '-af', `silencedetect=noise=${noiseDb}dB:d=${minSilence}`, '-f', 'null', '-'], { timeout: 120_000, maxBuffer: 8 * 1024 * 1024 }),
    probe(file),
  ]);
  const duration = info.duration;
  const silences = [];
  for (const line of stderr.split('\n')) {
    const s = /silence_start: (-?\d+(?:\.\d+)?)/.exec(line);
    const e = /silence_end: (\d+(?:\.\d+)?)/.exec(line);
    if (s) silences.push({ start: Math.max(0, Number(s[1])), end: null });
    else if (e && silences.length) silences[silences.length - 1].end = Number(e[1]);
  }
  let start = 0;
  let end = duration;
  const first = silences[0];
  if (first && first.start < 0.08 && first.end !== null) start = first.end;
  const last = silences[silences.length - 1];
  // a silence that never ended, or ended at the very end, runs to the end of the file
  if (last && (last.end === null || last.end >= duration - 0.08) && last.start > start) end = last.start;
  if (first && first.end === null && first.start < 0.08) throw new Error('recording_silent');
  if (!(end - start > 0.3)) throw new Error('recording_silent');
  return { start, end, duration };
}

/**
 * Own recording -> mono 32 kHz WAV, with long leading/trailing silence cut (a little room is left on both sides).
 * Returns the new length and where the speech sits inside it, for the subtitles.
 * @returns {Promise<{file: string, duration: number, lead: number, speech: number}>}
 */
export async function trimToSpeech(src, out, { lead = 0.2, tail = 0.3, timeoutMs = 120_000 } = {}) {
  const span = await speechSpan(src);
  const from = Math.max(0, span.start - lead);
  const to = Math.min(span.duration, span.end + tail);
  await run(FFMPEG, ['-hide_banner', '-v', 'error', '-y', '-ss', from.toFixed(3), '-t', (to - from).toFixed(3), '-i', src, '-vn', '-ac', '1', '-ar', '32000', '-sample_fmt', 's16', out], { timeoutMs });
  return { file: out, duration: to - from, lead: span.start - from, speech: span.end - span.start };
}
