import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';
import { FFMPEG, probe, run } from '../media.js';
import { buildAvatarAss, subtitleLines } from './subtitles.js';

export const REEL = { width: 1080, height: 1920 };
const escFilterPath = (p) => p.replace(/\\/g, '\\\\').replace(/:/g, '\\:').replace(/'/g, "\\'");

/**
 * Talking-head video (any size, e.g. 512x768) -> 1080x1920 reel: centre crop to 9:16, upscale, burned-in subtitles
 * in the voice language and the bottom plate. The talking-head file already carries the voice track.
 * One ffmpeg pass (x264 veryfast, 2 threads) so memory stays well below the 512 MB of Render Free.
 * @param {{video: string, chunks: {text: string, duration: number}[], out: string, workDir: string, plate?: string, timeoutMs?: number}} o
 */
export async function composeReel({ video, chunks, out, workDir, plate, timeoutMs = 10 * 60_000 }) {
  const info = await probe(video);
  if (!info.video) throw new Error('avatar_video_invalid');
  const total = info.duration;
  const ass = buildAvatarAss({ lines: subtitleLines(chunks), total, ...REEL, plate });
  const assFile = path.join(workDir, 'avatar.ass');
  await writeFile(assFile, ass);

  const vf = [
    "crop=w='trunc(min(iw\\,ih*9/16)/2)*2':h='trunc(min(ih\\,iw*16/9)/2)*2'",
    `scale=${REEL.width}:${REEL.height}:flags=lanczos`,
    `ass=filename='${escFilterPath(assFile)}':fontsdir='${escFilterPath(config.fontsDir)}'`,
    'format=yuv420p',
  ].join(',');
  await run(
    FFMPEG,
    ['-hide_banner', '-v', 'error', '-y', '-i', video, '-vf', vf, '-r', '30', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '21', '-threads', '2',
      ...(info.audio ? ['-c:a', 'aac', '-b:a', '160k', '-ar', '48000'] : ['-an']), '-movflags', '+faststart', out],
    { timeoutMs },
  );
  return { file: out, duration: total };
}
