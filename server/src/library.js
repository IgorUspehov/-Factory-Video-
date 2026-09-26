import { config } from './config.js';
import { libraryPhotos, libraryTracks, libraryVideos } from './libraryData.js';

export const MOODS = ['calm', 'energetic', 'premium', 'corporate'];
export const NICHES = ['music', 'business', 'lifestyle', 'tech', 'nature'];

const MOOD_WORDS = { calm: 'calm', energetic: 'energetic', premium: 'luxury', corporate: 'corporate' };
const NICHE_WORDS = { music: 'music studio', business: 'business office', lifestyle: 'lifestyle', tech: 'technology', nature: 'nature landscape' };
const TARGET = 20;
const TTL_MS = 6 * 3600_000;
const cache = new Map();

export function listAudio({ mood, niche }) {
  return libraryTracks.filter((t) => (!mood || t.mood === mood) && (!niche || t.niche === niche));
}

function staticMedia({ mood, niche, kind }) {
  return [...libraryPhotos, ...libraryVideos].filter(
    (i) => (!mood || i.mood === mood) && (!niche || i.niche === niche) && (!kind || i.kind === kind),
  );
}

/** Mood/niche → search combinations. Unfiltered dimensions are spread over their values. */
function combos(mood, niche) {
  const moods = mood ? [mood] : MOODS;
  const niches = niche ? [niche] : NICHES;
  const n = Math.max(moods.length, niches.length);
  return Array.from({ length: n }, (_, i) => ({ mood: moods[i % moods.length], niche: niches[i % niches.length] }));
}

async function pexels(path) {
  const hit = cache.get(path);
  if (hit && hit.until > Date.now()) return hit.data;
  const res = await fetch(`https://api.pexels.com${path}`, { headers: { Authorization: config.pexelsKey }, signal: AbortSignal.timeout(15_000) });
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

async function pexelsMedia({ mood, niche, kind }) {
  const list = combos(mood, niche);
  const perPage = Math.max(2, Math.ceil(TARGET / list.length));
  const results = await Promise.all(
    list.map(async (c) => {
      const q = encodeURIComponent(`${NICHE_WORDS[c.niche]} ${MOOD_WORDS[c.mood]}`);
      const items = [];
      if (kind !== 'video') {
        const data = await pexels(`/v1/search?query=${q}&per_page=${perPage}`);
        for (const p of data.photos ?? []) {
          items.push({
            id: `pexels-img-${p.id}`,
            kind: 'image',
            title: p.alt || `Pexels · ${p.photographer}`,
            url: p.src.large2x,
            thumb: p.src.medium,
            mood: c.mood,
            niche: c.niche,
            credit: { name: p.photographer, url: p.photographer_url, source: 'Pexels', page: p.url },
          });
        }
      }
      if (kind !== 'image') {
        const data = await pexels(`/videos/search?query=${q}&per_page=${Math.max(2, Math.ceil(perPage / 2))}`);
        for (const v of data.videos ?? []) {
          const file = pickVideoFile(v.video_files);
          if (!file) continue;
          items.push({
            id: `pexels-vid-${v.id}`,
            kind: 'video',
            title: `Pexels · ${v.user?.name ?? 'video'}`,
            url: file.link,
            thumb: v.image,
            mood: c.mood,
            niche: c.niche,
            duration: v.duration,
            credit: { name: v.user?.name, url: v.user?.url, source: 'Pexels', page: v.url },
          });
        }
      }
      return items;
    }),
  );
  const seen = new Set();
  return results.flat().filter((i) => !seen.has(i.id) && seen.add(i.id));
}

/** Pexels when PEXELS_API_KEY is set; the frontend's static list otherwise or on Pexels errors. */
export async function listMedia(filter) {
  if (!config.pexelsKey) return { items: staticMedia(filter), source: 'static' };
  try {
    return { items: await pexelsMedia(filter), source: 'pexels' };
  } catch (err) {
    console.warn('[library] Pexels failed, falling back to static list:', err.message);
    return { items: staticMedia(filter), source: 'static' };
  }
}
