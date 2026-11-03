import { FFMPEG, run } from '../media.js';

/** Joins TTS chunks (any WAV) into one 24 kHz mono 16-bit WAV in the given order. */
export async function concatWav(files, out, timeoutMs = 120_000) {
  const inputs = files.flatMap((f) => ['-i', f]);
  const filter = `${files.map((_, i) => `[${i}:a]`).join('')}concat=n=${files.length}:v=0:a=1,aresample=24000,aformat=sample_fmts=s16:channel_layouts=mono[a]`;
  await run(FFMPEG, ['-hide_banner', '-v', 'error', '-y', ...inputs, '-filter_complex', filter, '-map', '[a]', out], { timeoutMs });
  return out;
}
