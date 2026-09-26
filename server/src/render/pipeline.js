import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';
import { FFMPEG, run } from '../media.js';
import { buildAss } from './ass.js';
import { effectiveTimeline } from '../shared/timeline.js';

export const FPS = 30;
export const DIMENSIONS = { '9:16': [720, 1280], '16:9': [1280, 720], '1:1': [720, 720] };
const XFADE = { fade: 'fade', zoom: 'zoomin', slide: 'slideleft' };
const X264 = ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '21', '-pix_fmt', 'yuv420p', '-threads', '2'];

export { plannedDuration } from '../shared/timeline.js';

/** Runs ffmpeg with -progress and reports 0..1 of `seconds` of output. */
function ffmpeg(args, seconds, onProgress, timeoutMs) {
  let buf = '';
  return run(FFMPEG, ['-hide_banner', '-v', 'error', '-nostats', '-progress', 'pipe:1', '-y', ...args], {
    timeoutMs,
    onStdout: (d) => {
      buf += d;
      const lines = buf.split('\n');
      buf = lines.pop() ?? '';
      for (const line of lines) {
        const m = line.match(/^out_time_us=(\d+)/);
        if (m && seconds > 0) onProgress(Math.min(1, Number(m[1]) / 1e6 / seconds));
      }
    },
  });
}

const escFilterPath = (p) => p.replace(/\\/g, '\\\\').replace(/:/g, '\\:').replace(/'/g, "\\'");

/**
 * Input args + filter chain producing `count` frames of clip `c` starting at clip frame `from`.
 * Ken Burns uses the absolute clip frame so zoom stays continuous across pieces.
 */
function clipSource(c, from, count, inputIndex, label, W, H, kenBurns) {
  const fit = `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},setsar=1`;
  if (c.item.kind === 'image') {
    const input = ['-loop', '1', '-framerate', String(FPS), '-threads', '1', '-i', c.src];
    if (kenBurns) {
      const z = c.index % 2 === 0 ? `1+0.12*(on+${from})/${c.frames}` : `1.12-0.12*(on+${from})/${c.frames}`;
      const chain = `scale=${W * 2}:${H * 2}:force_original_aspect_ratio=increase,crop=${W * 2}:${H * 2},zoompan=z='${z}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=${W}x${H}:fps=${FPS},setsar=1,trim=end_frame=${count},setpts=PTS-STARTPTS,fps=${FPS}`;
      return { input, filter: `[${inputIndex}:v]${chain}${label}` };
    }
    return { input, filter: `[${inputIndex}:v]${fit},fps=${FPS},trim=end_frame=${count},setpts=PTS-STARTPTS,fps=${FPS}${label}` };
  }
  const input = ['-stream_loop', '-1', '-threads', '1', '-i', c.src];
  return { input, filter: `[${inputIndex}:v]fps=${FPS},${fit},trim=start_frame=${from}:end_frame=${from + count},setpts=PTS-STARTPTS,fps=${FPS}${label}` };
}

/**
 * Renders a project to MP4 (H.264 + AAC).
 * Video is built as small pieces (clip bodies and transitions, max. 2 inputs each, text burned in),
 * joined with the concat demuxer and muxed with the processed audio — memory stays flat with clip count.
 */
export async function renderProject({ project, format, watermark, workDir, resolveMedia, resolveAudio, onProgress, timeoutMs }) {
  const [W, H] = DIMENSIONS[format];
  await mkdir(workDir, { recursive: true });
  const style = project.style ?? {};
  const mediaById = new Map((project.media ?? []).map((m) => [m.id, m]));
  const audio = project.audio && project.audio.source !== 'none' && project.audio.url ? project.audio : null;
  // length mode, repetition over the track and beat snapping: same code as the frontend preview
  const plan = effectiveTimeline(project);
  const timeline = plan.clips;
  const durations = timeline.map((c) => c.duration);

  // frame-exact layout from cumulative times
  const starts = [0];
  for (const d of durations) starts.push(starts.at(-1) + d);
  const startFrames = starts.map((s) => Math.round(s * FPS));
  const clipFrames = durations.map((_, i) => startFrames[i + 1] - startFrames[i]);
  const totalFrames = timeline.length ? startFrames.at(-1) : Math.round(plan.total * FPS);
  const total = totalFrames / FPS;
  if (!(totalFrames > 0)) throw new Error('empty_project');

  const transition = XFADE[style.transition] && timeline.length > 1 ? XFADE[style.transition] : null;
  const Tf = transition ? Math.max(1, Math.min(Math.round(0.5 * FPS), Math.floor(0.4 * Math.min(...clipFrames)))) : 0;

  const clips = [];
  for (const [i, c] of timeline.entries()) {
    const item = mediaById.get(c.mediaId);
    clips.push({ index: i, item, src: await resolveMedia(item), frames: clipFrames[i] + (transition && i < timeline.length - 1 ? Tf : 0) });
  }

  const ass = buildAss({ project, width: W, height: H, total, watermark });
  const assFile = path.join(workDir, 'text.ass');
  if (ass) await writeFile(assFile, ass);
  const overlay = (label, startFrame, out) =>
    ass
      ? `${label}setpts=PTS+${(startFrame / FPS).toFixed(4)}/TB,ass=filename='${escFilterPath(assFile)}':fontsdir='${escFilterPath(config.fontsDir)}',setpts=PTS-STARTPTS,format=yuv420p${out}`
      : `${label}format=yuv420p${out}`;

  // ---- pieces: body_0, trans_1, body_1, trans_2, …
  const pieces = [];
  if (!clips.length) {
    const bg = /^#[0-9a-f]{6}$/i.test(style.background ?? '') ? style.background.slice(1) : '0B0B0D';
    pieces.push({ frames: totalFrames, start: 0, input: ['-f', 'lavfi', '-i', `color=c=0x${bg}:s=${W}x${H}:r=${FPS}`], filter: `[0:v]trim=end_frame=${totalFrames}[src]` });
  }
  for (const [i, c] of clips.entries()) {
    if (i > 0 && transition) {
      const a = clipSource(clips[i - 1], clipFrames[i - 1], Tf, 0, '[a]', W, H, style.kenBurns);
      const b = clipSource(c, 0, Tf, 1, '[b]', W, H, style.kenBurns);
      pieces.push({
        frames: Tf,
        start: startFrames[i],
        input: [...a.input, ...b.input],
        filter: `${a.filter};${b.filter};[a][b]xfade=transition=${transition}:duration=${(Tf / FPS).toFixed(4)}:offset=0[src]`,
      });
    }
    const from = i > 0 && transition ? Tf : 0;
    const count = clipFrames[i] - from;
    if (count > 0) {
      const s = clipSource(c, from, count, 0, '[src]', W, H, style.kenBurns);
      pieces.push({ frames: count, start: startFrames[i] + from, input: s.input, filter: s.filter });
    }
  }

  const list = [];
  let doneFrames = 0;
  for (const [k, p] of pieces.entries()) {
    const out = path.join(workDir, `piece_${String(k).padStart(4, '0')}.mp4`);
    await ffmpeg(
      [...p.input, '-filter_complex', `${p.filter};${overlay('[src]', p.start, '[v]')}`, '-map', '[v]', '-frames:v', String(p.frames), '-an', ...X264, '-r', String(FPS), out],
      p.frames / FPS,
      (x) => onProgress(Math.round(((doneFrames + x * p.frames) / totalFrames) * 95)),
      timeoutMs,
    );
    doneFrames += p.frames;
    list.push(`file '${out.replace(/'/g, "'\\''")}'`);
  }
  const listFile = path.join(workDir, 'pieces.txt');
  await writeFile(listFile, list.join('\n'));

  // ---- join + audio
  const args = ['-f', 'concat', '-safe', '0', '-i', listFile];
  let audioFilter;
  if (audio) {
    args.push('-i', await resolveAudio(audio));
    const chain = ['apad', `atrim=end=${total.toFixed(4)}`, 'asetpts=PTS-STARTPTS', 'loudnorm=I=-14:TP=-1.5:LRA=11', 'aresample=48000'];
    if (style.audioFadeIn) chain.push(`afade=t=in:st=0:d=${Math.min(1, total / 4).toFixed(2)}`);
    if (style.audioFadeOut) {
      const d = Math.min(1.5, total / 4);
      chain.push(`afade=t=out:st=${(total - d).toFixed(4)}:d=${d.toFixed(2)}`);
    }
    audioFilter = `[1:a]${chain.join(',')}[aout]`;
  } else {
    args.push('-f', 'lavfi', '-t', total.toFixed(4), '-i', 'anullsrc=r=48000:cl=stereo');
    audioFilter = '[1:a]anull[aout]';
  }
  const output = path.join(workDir, 'output.mp4');
  await ffmpeg(
    [...args, '-filter_complex', audioFilter, '-map', '0:v', '-map', '[aout]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-ar', '48000', '-t', total.toFixed(4), '-movflags', '+faststart', output],
    total,
    (x) => onProgress(Math.round(95 + x * 4)),
    timeoutMs,
  );
  onProgress(99);
  return { file: output, duration: total };
}
