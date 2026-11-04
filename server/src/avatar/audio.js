import { execFile } from 'node:child_process';
import { rename, rm } from 'node:fs/promises';
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
export async function speechSpan(file, { noiseDb, minSilence = 0.3 } = {}) {
  // The silence threshold follows the recording's own level (20 dB below its integrated loudness, within -70…-30 dB):
  // a quiet recording is not mistaken for silence, and room noise in a loud one still counts as silence.
  if (noiseDb === undefined) {
    const { I } = await measureLoudness(file).catch(() => ({ I: NaN }));
    if (!Number.isFinite(I)) throw new Error('recording_silent'); // digital silence: ffmpeg reports -inf
    noiseDb = Math.min(-30, Math.max(-70, Math.round(I - 20)));
  }
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

export const TARGET_LUFS = -14;
const LOUDNORM = `I=${TARGET_LUFS}:TP=-1.5:LRA=11`;

/**
 * First loudnorm pass: integrated loudness (LUFS), true peak (dBTP) and the values the second pass needs.
 * `input` are extra ffmpeg input options (e.g. -ss/-t) so a part of a file can be measured.
 */
export async function measureLoudness(file, input = []) {
  const { stderr } = await execFileP(FFMPEG, ['-hide_banner', '-nostats', ...input, '-i', file, '-af', `loudnorm=${LOUDNORM}:print_format=json`, '-f', 'null', '-'], { timeout: 120_000, maxBuffer: 8 * 1024 * 1024 });
  const json = /\{[^{}]*"input_i"[^{}]*\}/.exec(stderr);
  if (!json) throw new Error('loudness_measure_failed');
  const m = JSON.parse(json[0]);
  const n = (v) => Number(v);
  return { I: n(m.input_i), TP: n(m.input_tp), LRA: n(m.input_lra), thresh: n(m.input_thresh), offset: n(m.target_offset) };
}

/**
 * Own recording -> mono 32 kHz WAV, with long leading/trailing silence cut (a little room is left on both sides)
 * and the loudness normalised to -14 LUFS (two-pass loudnorm: measured first, then applied linearly, so the result
 * lands on the target instead of near it). Returns the new length and where the speech sits inside it, for the subtitles.
 * @returns {Promise<{file: string, duration: number, lead: number, speech: number, lufsBefore: number, lufsAfter: number}>}
 */
export async function trimToSpeech(src, out, { lead = 0.2, tail = 0.3, timeoutMs = 120_000 } = {}) {
  const span = await speechSpan(src);
  const from = Math.max(0, span.start - lead);
  const to = Math.min(span.duration, span.end + tail);
  const cut = ['-ss', from.toFixed(3), '-t', (to - from).toFixed(3)];
  const m = await measureLoudness(src, cut);
  const finite = [m.I, m.TP, m.LRA, m.thresh, m.offset].every(Number.isFinite);
  const measured = `measured_I=${m.I}:measured_TP=${m.TP}:measured_LRA=${m.LRA}:measured_thresh=${m.thresh}:offset=${m.offset}`;
  const encode = (file, loudnorm) =>
    run(FFMPEG, ['-hide_banner', '-v', 'error', '-y', ...cut, '-i', src, '-vn', '-af', `${loudnorm},aresample=32000`, '-ac', '1', '-ar', '32000', '-sample_fmt', 's16', file], { timeoutMs });

  // 1) linear: the exact gain, nothing else changes. Dynamic speech may hit the true-peak ceiling first and stay below -14.
  await encode(out, finite ? `loudnorm=${LOUDNORM}:${measured}:linear=true` : `loudnorm=${LOUDNORM}`);
  let after = (await measureLoudness(out)).I;
  // 2) Dynamic speech hits the true-peak ceiling before -14 and stays below it. Then the gain is raised to the target and a
  //    limiter catches the peaks (as in mastering); the result is measured again and the gain corrected, at most 3 times.
  if (finite && !(Math.abs(after - TARGET_LUFS) <= 0.5)) {
    let gain = TARGET_LUFS - m.I;
    for (let attempt = 0; attempt < 3; attempt++) {
      const alt = `${out}.limited.wav`;
      await encode(alt, `volume=${gain.toFixed(2)}dB,alimiter=limit=0.8:level=0:attack=3:release=50`);
      const altI = (await measureLoudness(alt)).I;
      if (Math.abs(altI - TARGET_LUFS) < Math.abs(after - TARGET_LUFS)) {
        await rename(alt, out);
        after = altI;
      } else await rm(alt, { force: true });
      if (Math.abs(after - TARGET_LUFS) <= 0.3) break;
      gain += TARGET_LUFS - altI;
    }
  }
  return { file: out, duration: to - from, lead: span.start - from, speech: span.end - span.start, lufsBefore: m.I, lufsAfter: after };
}
