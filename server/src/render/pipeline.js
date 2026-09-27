import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';
import { FFMPEG, run } from '../media.js';
import { buildAss } from './ass.js';
import { effectiveTimeline } from '../shared/timeline.js';
import { beatFxOf, FX_PRESETS } from '../shared/effects.js';

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

const even = (v) => Math.round(v / 2) * 2;

const PARALLAX_MARGIN = 0.08; // room around the frame for the drift
const parallaxSizes = (W, H) => {
  const W2 = even(W * (1 + 2 * PARALLAX_MARGIN));
  const H2 = even(H * (1 + 2 * PARALLAX_MARGIN));
  return { W2, H2, W3: even(W2 * 1.04), H3: even(H2 * 1.04) };
};

/**
 * 2.5D parallax, step 1 — once per photo (not per piece): split the photo into two still layers.
 * - foreground: the photo (slightly enlarged) with a soft alpha mask from the depth map (near = bright);
 * - background: the photo with the foreground area filled from the surrounding background
 *   (normalised convolution: blur(image × background weight) ÷ blur(background weight)), so the edge
 *   that the moving foreground uncovers shows background colours instead of a ghost copy.
 * Both layers are PNG files in the job's work dir; ~0.5 s and ~150 MB per photo.
 */
export async function prepareParallaxLayers({ src, depthSrc, threshold, W, H, outDir, timeoutMs }) {
  const { W2, H2, W3, H3 } = parallaxSizes(W, H);
  const thr = Math.min(235, Math.max(20, Math.round(Number(threshold) || 128)));
  const cover = `scale=${W2}:${H2}:force_original_aspect_ratio=increase,crop=${W2}:${H2}`;
  const graph = [
    `[1:v]${cover},format=gray,split=3[da][db][dc]`,
    `[da]lut=y='clip((val-${thr})*5,0,255)',scale=${W3}:${H3},gblur=sigma=8[mask]`,
    // "hole" = where the foreground is, a bit larger than the mask
    `[db]lut=y='clip((val-${thr - 12})*6,0,255)',gblur=sigma=10,lut=y='clip(val*3,0,255)',split[hole1][hole2]`,
    '[dc]nullsink',
    // background weight (small floor so the division never hits 0)
    `[hole1]negate,lut=y='val*0.9+25',split=3[k1][k2][k3]`,
    '[k1][k2][k3]mergeplanes=0x001020:gbrp,split[inv1][inv2]',
    `[0:v]${cover},setsar=1,format=gbrp,split=3[i1][i2][i3]`,
    '[i1][inv1]blend=all_mode=multiply,gblur=sigma=45[num]',
    '[inv2]gblur=sigma=45[den]',
    "[num][den]blend=all_expr='min(255,A*255/B)',format=gbrap[fill]",
    '[fill][hole2]alphamerge[filla]',
    '[i2][filla]overlay=format=gbrp[bg]',
    `[i3]scale=${W3}:${H3},format=gbrap[fgc]`,
    '[fgc][mask]alphamerge[fg]',
  ].join(';');
  await mkdir(outDir, { recursive: true });
  const bg = path.join(outDir, 'bg.png');
  const fg = path.join(outDir, 'fg.png');
  await run(FFMPEG, ['-hide_banner', '-v', 'error', '-y', '-threads', '1', '-i', src, '-threads', '1', '-i', depthSrc, '-filter_complex', graph, '-map', '[bg]', '-frames:v', '1', '-update', '1', bg, '-map', '[fg]', '-frames:v', '1', '-update', '1', fg], { timeoutMs });
  return { bg, fg };
}

/**
 * 2.5D parallax, step 2 — per piece: the two prepared layers are decoded once and repeated (`loop`);
 * per frame only a crop of the background (small drift) and an overlay of the foreground (≈ 3× larger
 * drift) run — no per-frame scaling, so it fits 0.5 CPU / 512 MB. Direction changes per shot.
 */
function parallaxSource(c, from, count, first, label, W, H) {
  const tag = label.replace(/\W/g, '');
  const m = PARALLAX_MARGIN;
  const { W3, H3 } = parallaxSizes(W, H);
  const P = `((n+${from})/${c.frames}*2-1)`;
  const [dx, dy] = [[1, 0], [0, 1], [-1, 0], [0, -1]][c.index % 4];
  const bx = `${(-dx * 0.2 * m * W).toFixed(2)}*${P}`;
  const by = `${(-dy * 0.2 * m * H).toFixed(2)}*${P}`;
  const fx = `${(-dx * 0.6 * m * W).toFixed(2)}*${P}`;
  const fy = `${(-dy * 0.6 * m * H).toFixed(2)}*${P}`;
  const input = ['-threads', '1', '-i', c.layers.bg, '-threads', '1', '-i', c.layers.fg];
  const filter = [
    `[${first}:v]format=yuv420p,loop=loop=-1:size=1,crop=${W}:${H}:x='(iw-ow)/2+${bx}':y='(ih-oh)/2+${by}'[${tag}bg]`,
    `[${first + 1}:v]format=yuva420p,loop=loop=-1:size=1[${tag}fg]`,
    `[${tag}bg][${tag}fg]overlay=x='${(W - W3) / 2}+${fx}':y='${(H - H3) / 2}+${fy}':format=yuv420,trim=end_frame=${count},setpts=PTS-STARTPTS,fps=${FPS},setsar=1${label}`,
  ].join(';');
  return { input, filter, inputs: 2 };
}

/**
 * Input args + filter chain producing `count` frames of clip `c` starting at clip frame `from`.
 * Ken Burns uses the absolute clip frame so zoom stays continuous across pieces.
 * Photos with a depth map and parallax enabled use parallaxSource; without a map they fall back to Ken Burns.
 */
function clipSource(c, from, count, first, label, W, H, style) {
  if (c.item.kind === 'image' && style.parallax && c.layers) return parallaxSource(c, from, count, first, label, W, H);
  const kenBurns = style.kenBurns || style.parallax; // parallax without a depth map → Ken Burns
  const fit = `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},setsar=1`;
  if (c.item.kind === 'image') {
    const input = ['-loop', '1', '-framerate', String(FPS), '-threads', '1', '-i', c.src];
    if (kenBurns) {
      const z = c.index % 2 === 0 ? `1+0.12*(on+${from})/${c.frames}` : `1.12-0.12*(on+${from})/${c.frames}`;
      const chain = `scale=${W * 2}:${H * 2}:force_original_aspect_ratio=increase,crop=${W * 2}:${H * 2},zoompan=z='${z}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=${W}x${H}:fps=${FPS},setsar=1,trim=end_frame=${count},setpts=PTS-STARTPTS,fps=${FPS}`;
      return { input, filter: `[${first}:v]${chain}${label}`, inputs: 1 };
    }
    return { input, filter: `[${first}:v]${fit},fps=${FPS},trim=end_frame=${count},setpts=PTS-STARTPTS,fps=${FPS}${label}`, inputs: 1 };
  }
  const input = ['-stream_loop', '-1', '-threads', '1', '-i', c.src];
  return { input, filter: `[${first}:v]fps=${FPS},${fit},trim=start_frame=${from}:end_frame=${from + count},setpts=PTS-STARTPTS,fps=${FPS}${label}`, inputs: 1 };
}

/**
 * Beat-synced effects for one piece. `offset` = global start time of the piece in seconds; inside the
 * piece timestamps start at 0, so every expression uses (t + offset). Only beats that touch the piece are
 * written into the expressions, which keeps them short. Returns '' when nothing applies.
 */
export function beatFxChain(preset, beats, offset, seconds, W, H) {
  if (!preset || !beats?.length) return '';
  const w = preset.width;
  const pick = (every) => beats.filter((_, i) => every > 0 && i % every === 0).filter((b) => b + w >= offset && b <= offset + seconds);
  const main = pick(preset.every);
  if (!main.length) return '';
  const pulse = (v, bs) =>
    bs.length ? bs.map((b) => `between(${v}+${offset.toFixed(3)},${b.toFixed(3)},${(b + w).toFixed(3)})*(1-(${v}+${offset.toFixed(3)}-${b.toFixed(3)})/${w})`).join('+') : '0';
  const parts = [];
  if (preset.punch) {
    const p = pulse('it', main);
    const shakeX = preset.shake ? `+iw*${preset.shake}*(${p})*sin(it*95)` : '';
    const shakeY = preset.shake ? `+ih*${(preset.shake * 0.7).toFixed(4)}*(${p})*cos(it*83)` : '';
    parts.push(`zoompan=z='1+${preset.punch}*(${p})':x='iw/2-(iw/zoom/2)${shakeX}':y='ih/2-(ih/zoom/2)${shakeY}':d=1:s=${W}x${H}:fps=${FPS},setpts=N/(${FPS}*TB)`);
  }
  if (preset.flash) {
    const f = pulse('t', pick(preset.flashEvery));
    if (f !== '0') parts.push(`eq=brightness='${preset.flash}*(${f})':contrast='1+${preset.flash}*(${f})':eval=frame`);
  }
  if (preset.color) {
    const c = pulse('t', main);
    parts.push(`hue=s='1+${preset.color}*(${c})'${preset.hue ? `:H='${preset.hue}*(${c})'` : ''}`);
  }
  if (preset.glitchEvery) {
    const g = pick(preset.glitchEvery).map((b) => `between(t+${offset.toFixed(3)},${b.toFixed(3)},${(b + 0.08).toFixed(3)})`);
    if (g.length) parts.push(`rgbashift=rh=14:bh=-14:gv=4:enable='${g.join('+')}'`);
  }
  return parts.length ? `${parts.join(',')},format=yuv420p` : '';
}

/**
 * Renders a project to MP4 (H.264 + AAC).
 * Video is built as small pieces (clip bodies and transitions, max. 2 inputs each, text burned in),
 * joined with the concat demuxer and muxed with the processed audio — memory stays flat with clip count.
 */
export async function renderProject({ project, format, watermark, workDir, resolveMedia, resolveAudio, resolveDepth = async () => null, onProgress, timeoutMs }) {
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
  const layerCache = new Map();
  for (const [i, c] of timeline.entries()) {
    const item = mediaById.get(c.mediaId);
    const src = await resolveMedia(item);
    // parallax layers once per photo (shots repeat photos); a failure only means Ken Burns for that photo
    let layers = null;
    if (item.kind === 'image' && style.parallax && item.depth) {
      if (!layerCache.has(item.id)) {
        const depthSrc = await resolveDepth(item.depth);
        layerCache.set(
          item.id,
          depthSrc
            ? await prepareParallaxLayers({ src, depthSrc, threshold: item.depth.threshold, W, H, outDir: path.join(workDir, 'layers', item.id), timeoutMs }).catch((err) => {
                console.warn(`[render] parallax layers failed for ${item.id}, using Ken Burns:`, err.message);
                return null;
              })
            : null,
        );
      }
      layers = layerCache.get(item.id);
    }
    clips.push({ index: i, item, src, layers, frames: clipFrames[i] + (transition && i < timeline.length - 1 ? Tf : 0) });
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
      const a = clipSource(clips[i - 1], clipFrames[i - 1], Tf, 0, '[a]', W, H, style);
      const b = clipSource(c, 0, Tf, a.inputs, '[b]', W, H, style);
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
      const s = clipSource(c, from, count, 0, '[src]', W, H, style);
      pieces.push({ frames: count, start: startFrames[i] + from, input: s.input, filter: s.filter });
    }
  }

  // beat effects (preset from style.beatFx or the mood default); needs a track with beats
  const fxPreset = audio?.beats?.length ? FX_PRESETS[beatFxOf(project)] : null;
  const fxOf = (p) => beatFxChain(fxPreset, audio?.beats, p.start / FPS, p.frames / FPS, W, H);
  const withFx = (p) => (fxOf(p) ? `[src]${fxOf(p)}[fx];` : '');
  const fxLabel = (p) => (fxOf(p) ? '[fx]' : '[src]');

  const list = [];
  let doneFrames = 0;
  for (const [k, p] of pieces.entries()) {
    const out = path.join(workDir, `piece_${String(k).padStart(4, '0')}.mp4`);
    await ffmpeg(
      [...p.input, '-filter_complex', `${p.filter};${withFx(p)}${overlay(fxLabel(p), p.start, '[v]')}`, '-map', '[v]', '-frames:v', String(p.frames), '-an', ...X264, '-r', String(FPS), out],
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
