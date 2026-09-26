/**
 * Video length, clip sequence and render cost — ONE implementation used by the backend
 * (render + cost) and the frontend (display + cost preview), so both always agree.
 * Plain JS with types in timeline.d.ts; imported by the frontend as ../../server/src/shared/timeline.js.
 */

export const MAX_VIDEO_SECONDS = 300;
export const LENGTH_PRESETS = [15, 30, 60];
const MIN_CLIP = 0.5;

/** 1 credit per started 30 seconds. */
export function renderCost(durationSec) {
  return Math.max(1, Math.ceil(durationSec / 30));
}

/** Music video: as long as the track; promo / reels: as long as the montage. */
export function defaultLengthMode(goal) {
  return goal === 'clip' ? 'track' : 'timeline';
}

export function lengthModeOf(project) {
  const m = project.lengthMode;
  if (m === 'track' || m === 'timeline') return m;
  if (typeof m === 'number' && m > 0) return m;
  return defaultLengthMode(project.goal);
}

export function trackDuration(project) {
  const a = project.audio;
  return a && a.source !== 'none' ? Number(a.duration) || 0 : 0;
}

function baseClips(project) {
  const ids = new Set((project.media ?? []).map((m) => m.id));
  return (project.timeline ?? []).filter((c) => ids.has(c.mediaId) && Number(c.duration) > 0);
}

/** Moves every cut to the nearest beat, keeping each clip ≥ 0.5 s and the total unchanged. */
export function snapToBeats(durations, beats) {
  if (!beats?.length || durations.length < 2) return durations;
  const out = [];
  let prev = 0;
  let planned = 0;
  durations.forEach((d, i) => {
    planned += d;
    if (i === durations.length - 1) {
      out.push(Math.max(MIN_CLIP, planned - prev));
      return;
    }
    const candidates = beats.filter((b) => b >= prev + MIN_CLIP && b <= planned + (durations[i + 1] ?? 0) - MIN_CLIP);
    const cut = candidates.length ? candidates.reduce((best, b) => (Math.abs(b - planned) < Math.abs(best - planned) ? b : best)) : planned;
    out.push(cut - prev);
    prev = cut;
  });
  return out;
}

/**
 * The sequence that is actually rendered.
 * - 'timeline': the montage as edited.
 * - 'track' / number of seconds: the montage clips spread evenly over the target length,
 *   repeated in order when there are too few; each shot keeps roughly the average montage clip length.
 * With beatSync every cut is moved to the nearest beat.
 */
export function effectiveTimeline(project) {
  const mode = lengthModeOf(project);
  const base = baseClips(project);
  const track = trackDuration(project);
  const montage = base.reduce((s, c) => s + Number(c.duration), 0);

  let target;
  if (mode === 'timeline') target = montage;
  else if (mode === 'track') target = track || montage;
  else target = mode;

  let clips;
  if (!base.length) clips = [];
  else if (mode === 'timeline') clips = base.map((c) => ({ mediaId: c.mediaId, duration: Number(c.duration) }));
  else {
    const shot = Math.max(1, montage / base.length);
    const count = Math.max(1, Math.round(target / shot));
    clips = Array.from({ length: count }, (_, i) => ({ mediaId: base[i % base.length].mediaId, duration: target / count }));
  }

  const beats = project.audio && project.audio.source !== 'none' ? project.audio.beats : null;
  if (project.style?.beatSync && beats?.length && clips.length > 1) {
    const snapped = snapToBeats(clips.map((c) => c.duration), beats);
    clips = clips.map((c, i) => ({ ...c, duration: snapped[i] }));
  }

  let total = clips.reduce((s, c) => s + c.duration, 0);
  if (!clips.length) total = mode === 'timeline' ? Math.min(track, 30) : target || Math.min(track, 30);
  return { clips, total: Math.round(total * 1000) / 1000, mode, target };
}

/** Length in seconds that will be rendered (and billed). */
export function plannedDuration(project) {
  return effectiveTimeline(project).total;
}
