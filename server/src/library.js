import { config } from './config.js';
import { libraryPhotos, libraryTracks, libraryVideos } from './libraryData.js';

export const MOODS = ['calm', 'energetic', 'premium', 'corporate'];
export const NICHES = ['music', 'business', 'lifestyle', 'tech', 'nature'];
export const ORIENTATIONS = ['portrait', 'landscape', 'square'];

// Used only when the user did not type a query and picked mood/niche chips.
const MOOD_WORDS = { calm: 'calm', energetic: 'energetic', premium: 'luxury', corporate: 'corporate' };
const NICHE_WORDS = { music: 'musician on stage', business: 'modern business', lifestyle: 'lifestyle people', tech: 'technology', nature: 'nature landscape' };
const DEFAULT_QUERY = 'cinematic';
// Pexels search understands many languages when `locale` is passed (no own dictionary needed).
const LOCALES = { de: 'de-DE', en: 'en-US', ru: 'ru-RU' };
const PHOTOS_PER_PAGE = 20;
const VIDEOS_PER_PAGE = 8;
const TTL_MS = 6 * 3600_000;
const cache = new Map();

export function listAudio({ mood, niche }) {
  return libraryTracks.filter((t) => (!mood || t.mood === mood) && (!niche || t.niche === niche));
}

function staticMedia({ q, mood, niche, kind, page }) {
  if (page > 1) return [];
  const words = (q ?? '').toLowerCase().split(/\s+/).filter(Boolean);
  return [...libraryPhotos, ...libraryVideos].filter(
    (i) =>
      (!mood || i.mood === mood) &&
      (!niche || i.niche === niche) &&
      (!kind || i.kind === kind) &&
      (!words.length || words.some((w) => `${i.title} ${i.mood} ${i.niche}`.toLowerCase().includes(w))),
  );
}

async function pexels(path) {
  const hit = cache.get(path);
  if (hit && hit.until > Date.now()) return hit.data;
  const res = await fetch(`${config.pexelsBase}${path}`, { headers: { Authorization: config.pexelsKey }, signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`pexels ${res.status}`);
  const data = await res.json();
  cache.set(path, { data, until: Date.now() + TTL_MS });
  return data;
}

function pickVideoFile(files) {
  const mp4 = (files ?? []).filter((f) => f.file_type === 'video/mp4' && f.width && f.height);
  mp4.sort((a, b) => Math.min(a.width, a.height) - Math.min(b.width, b.height));
  return mp4.find((f) => Math.min(f.width, f.height) >= 720) ?? mp4[mp4.length - 1];
}

export function buildQuery({ q, mood, niche }) {
  const typed = (q ?? '').trim().slice(0, 100);
  if (typed) return typed;
  return [NICHE_WORDS[niche], MOOD_WORDS[mood]].filter(Boolean).join(' ') || DEFAULT_QUERY;
}

async function pexelsMedia({ q, mood, niche, kind, orientation, page, lang }) {
  const query = buildQuery({ q, mood, niche });
  const params = new URLSearchParams({ query, page: String(page) });
  if (orientation) params.set('orientation', orientation);
  const locale = (q ?? '').trim() ? LOCALES[lang] : 'en-US';
  if (locale) params.set('locale', locale);

  const jobs = [];
  if (kind !== 'video') jobs.push(pexels(`/v1/search?${params}&per_page=${PHOTOS_PER_PAGE}`).then((d) => ({ type: 'image', d })));
  if (kind !== 'image') jobs.push(pexels(`/videos/search?${params}&per_page=${VIDEOS_PER_PAGE}`).then((d) => ({ type: 'video', d })));
  const settled = await Promise.allSettled(jobs);
  const ok = settled.filter((s) => s.status === 'fulfilled').map((s) => s.value);
  if (!ok.length) throw settled[0].reason;

  const items = [];
  for (const { type, d } of ok) {
    if (type === 'image') {
      for (const p of d.photos ?? []) {
        items.push({
          id: `pexels-img-${p.id}`,
          kind: 'image',
          title: p.alt || `Pexels · ${p.photographer}`,
          url: p.src.large2x,
          thumb: p.src.medium,
          mood,
          niche,
          credit: { name: p.photographer, url: p.photographer_url, source: 'Pexels', page: p.url },
        });
      }
    } else {
      for (const v of d.videos ?? []) {
        const file = pickVideoFile(v.video_files);
        if (!file) continue;
        items.push({
          id: `pexels-vid-${v.id}`,
          kind: 'video',
          title: `Pexels · ${v.user?.name ?? 'video'}`,
          url: file.link,
          thumb: v.image,
          mood,
          niche,
          duration: v.duration,
          credit: { name: v.user?.name, url: v.user?.url, source: 'Pexels', page: v.url },
        });
      }
    }
  }
  // interleave a video after every few photos so both kinds are visible on the first screen
  if (kind !== 'image' && kind !== 'video') {
    const photos = items.filter((i) => i.kind === 'image');
    const videos = items.filter((i) => i.kind === 'video');
    const mixed = [];
    while (photos.length || videos.length) {
      mixed.push(...photos.splice(0, 3));
      if (videos.length) mixed.push(videos.shift());
    }
    return mixed;
  }
  return items;
}

/**
 * Pexels when PEXELS_API_KEY is set (search, orientation, paging); the frontend's static list otherwise
 * or when every Pexels call fails. An empty page means "no more results".
 */
export async function listMedia(filter) {
  if (!config.pexelsKey) return { items: staticMedia(filter), source: 'static' };
  try {
    return { items: await pexelsMedia(filter), source: 'pexels' };
  } catch (err) {
    console.warn('[library] Pexels failed, falling back to static list:', err.message);
    return { items: staticMedia(filter), source: 'static' };
  }
}
