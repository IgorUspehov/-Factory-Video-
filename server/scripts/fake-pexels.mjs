/**
 * Minimal stand-in for the Pexels API (same JSON shape) for tests without a real key.
 * Results are deterministic per query/page/orientation; images point to allow-listed Unsplash photos.
 * Usage: node scripts/fake-pexels.mjs [port]   or   import { startFakePexels } from './fake-pexels.mjs'
 */
import http from 'node:http';
import { createHash } from 'node:crypto';

const PHOTOS = [
  '1598488035139-bdbb2231ce04', '1478737270239-2f02b77fc618', '1493225457124-a3eb161ffa5f', '1470225620780-dba8ba36b745',
  '1514525253161-7a46d19cd819', '1511671782779-c97d3d27a1d4', '1520523839897-bd0b52f945a0', '1574717024653-61fd2cf4d44d',
  '1550745165-9bc0b252726f', '1460925895917-afdab827c52f', '1542744173-8e7e53415bb0', '1522202176988-66273c2fd55f',
];
const VIDEOS = ['Jellyfish', 'Sintel'];
const PAGES = 3;
export const requests = [];

const num = (s) => parseInt(createHash('md5').update(s).digest('hex').slice(0, 8), 16);
const unsplash = (id, w, h) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&h=${h}&q=70`;

function photos(q, page, perPage, orientation) {
  if (page > PAGES) return [];
  return Array.from({ length: perPage }, (_, i) => {
    const id = (num(`${q}|${orientation}`) % 900000) * 10000 + page * 100 + i;
    const img = PHOTOS[(num(q) + page * perPage + i) % PHOTOS.length];
    const [w, h] = orientation === 'portrait' ? [720, 1280] : orientation === 'square' ? [900, 900] : [1280, 720];
    return {
      id,
      alt: `${q} #${page}.${i}`,
      photographer: `Fixture Photographer ${i}`,
      photographer_url: `https://www.pexels.com/@fixture-${i}`,
      url: `https://www.pexels.com/photo/${id}/`,
      src: { large2x: unsplash(img, w, h), medium: unsplash(img, 350, 350), tiny: unsplash(img, 140, 140) },
    };
  });
}

function videos(q, page, perPage) {
  if (page > PAGES) return [];
  return Array.from({ length: perPage }, (_, i) => {
    const id = (num(`v${q}`) % 900000) * 10000 + page * 100 + i;
    const name = VIDEOS[i % VIDEOS.length];
    return {
      id,
      duration: 10,
      url: `https://www.pexels.com/video/${id}/`,
      image: unsplash(PHOTOS[(num(q) + i) % PHOTOS.length], 400, 400),
      user: { name: `Fixture Filmmaker ${i}`, url: `https://www.pexels.com/@film-${i}` },
      video_files: [
        { file_type: 'video/mp4', width: 640, height: 360, link: `https://test-videos.co.uk/vids/${name.toLowerCase()}/mp4/h264/360/${name}_360_10s_1MB.mp4` },
        { file_type: 'video/mp4', width: 1280, height: 720, link: `https://test-videos.co.uk/vids/${name.toLowerCase()}/mp4/h264/720/${name}_720_10s_1MB.mp4` },
      ],
    };
  });
}

export function startFakePexels(port = 0) {
  const server = http.createServer(async (req, res) => {
    const maxDelay = Number(process.env.FAKE_PEXELS_MAX_DELAY_MS ?? 0);
    if (maxDelay) await new Promise((r) => setTimeout(r, Math.random() * maxDelay));
    // deterministic slow answer for stale-response tests: queries containing "slow" take 4 s
    if (/slow/i.test(new URL(req.url, 'http://x').searchParams.get('query') ?? '')) await new Promise((r) => setTimeout(r, 4000));
    const url = new URL(req.url, 'http://x');
    requests.push({ path: url.pathname, query: Object.fromEntries(url.searchParams), auth: req.headers.authorization });
    const q = url.searchParams.get('query') ?? '';
    const page = Number(url.searchParams.get('page') ?? 1);
    const perPage = Number(url.searchParams.get('per_page') ?? 15);
    const orientation = url.searchParams.get('orientation') ?? 'landscape';
    let body;
    if (url.pathname === '/v1/search') body = { page, per_page: perPage, photos: photos(q, page, perPage, orientation), total_results: PAGES * perPage };
    else if (url.pathname === '/videos/search') body = { page, per_page: perPage, videos: videos(q, page, perPage), total_results: PAGES * perPage };
    else {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(body));
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve({ server, port: server.address().port })));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { port } = await startFakePexels(Number(process.argv[2]) || 18999);
  console.log(`fake Pexels on http://127.0.0.1:${port}`);
}
