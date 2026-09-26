import type { LibraryMedia, LibraryTrack } from '../types';

export const unsplash = (id: string, w = 1200, h?: number) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}${h ? `&h=${h}` : ''}&q=75`;

/** Landing page imagery (dark workspaces, studios, neon, musicians, film sets). */
export const landingPhotos = {
  studio: '1598488035139-bdbb2231ce04',
  editing: '1574717024653-61fd2cf4d44d',
  dj: '1470225620780-dba8ba36b745',
  lenses: '1516035069371-29a1b244cc32',
  mic: '1478737270239-2f02b77fc618',
  performer: '1493225457124-a3eb161ffa5f',
  restaurant: '1517248135467-4c7edcad34c4',
  neon: '1550745165-9bc0b252726f',
  concert: '1514525253161-7a46d19cd819',
  projector: '1535016120720-40c646be5580',
};

const sh = (n: number) => `https://www.soundhelix.com/examples/mp3/SoundHelix-Song-${n}.mp3`;

export const libraryTracks: LibraryTrack[] = [
  { id: 'trk-1', title: 'Neon Drive', artist: 'SoundHelix', mood: 'energetic', niche: 'music', duration: 372, bpm: 124, url: sh(1) },
  { id: 'trk-2', title: 'Night Shift', artist: 'SoundHelix', mood: 'premium', niche: 'lifestyle', duration: 425, bpm: 98, url: sh(2) },
  { id: 'trk-3', title: 'Morning Glass', artist: 'SoundHelix', mood: 'calm', niche: 'nature', duration: 344, bpm: 84, url: sh(3) },
  { id: 'trk-4', title: 'Quarterly', artist: 'SoundHelix', mood: 'corporate', niche: 'business', duration: 302, bpm: 110, url: sh(4) },
  { id: 'trk-5', title: 'Circuit Board', artist: 'SoundHelix', mood: 'energetic', niche: 'tech', duration: 353, bpm: 128, url: sh(5) },
  { id: 'trk-6', title: 'Velvet Room', artist: 'SoundHelix', mood: 'premium', niche: 'business', duration: 307, bpm: 92, url: sh(6) },
  { id: 'trk-7', title: 'Open Field', artist: 'SoundHelix', mood: 'calm', niche: 'lifestyle', duration: 428, bpm: 76, url: sh(7) },
  { id: 'trk-8', title: 'Launch Day', artist: 'SoundHelix', mood: 'corporate', niche: 'tech', duration: 308, bpm: 116, url: sh(8) },
];

const photo = (id: string, title: string, mood: LibraryMedia['mood'], niche: LibraryMedia['niche']): LibraryMedia => ({
  id: `img-${id}`,
  kind: 'image',
  title,
  url: unsplash(id, 1600),
  thumb: unsplash(id, 400, 400),
  mood,
  niche,
});

export const libraryPhotos: LibraryMedia[] = [
  photo('1598488035139-bdbb2231ce04', 'Studio', 'premium', 'music'),
  photo('1478737270239-2f02b77fc618', 'Mic', 'calm', 'music'),
  photo('1493225457124-a3eb161ffa5f', 'Stage', 'energetic', 'music'),
  photo('1470225620780-dba8ba36b745', 'DJ', 'energetic', 'music'),
  photo('1514525253161-7a46d19cd819', 'Lights', 'energetic', 'music'),
  photo('1511671782779-c97d3d27a1d4', 'Vintage mic', 'premium', 'music'),
  photo('1520523839897-bd0b52f945a0', 'Piano', 'calm', 'music'),
  photo('1574717024653-61fd2cf4d44d', 'Edit suite', 'premium', 'tech'),
  photo('1550745165-9bc0b252726f', 'Retro neon', 'energetic', 'tech'),
  photo('1460925895917-afdab827c52f', 'Dashboard', 'corporate', 'tech'),
  photo('1542744173-8e7e53415bb0', 'Meeting', 'corporate', 'business'),
  photo('1522202176988-66273c2fd55f', 'Team', 'corporate', 'business'),
  photo('1517248135467-4c7edcad34c4', 'Restaurant', 'premium', 'business'),
  photo('1414235077428-338989a2e8c0', 'Dinner', 'premium', 'lifestyle'),
  photo('1487180144351-b8472da7d491', 'Boombox', 'energetic', 'lifestyle'),
  photo('1441974231531-c6227db76b6e', 'Forest', 'calm', 'nature'),
  photo('1470071459604-3b5ec3a7fe05', 'Highlands', 'calm', 'nature'),
  photo('1492691527719-9d1e07e534b4', 'Summit', 'calm', 'nature'),
];

const tv = (name: string) => `https://test-videos.co.uk/vids/${name.toLowerCase()}/mp4/h264/360/${name}_360_10s_1MB.mp4`;

export const libraryVideos: LibraryMedia[] = [
  { id: 'vid-flower', kind: 'video', title: 'Bloom', url: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4', thumb: unsplash('1441974231531-c6227db76b6e', 400, 400), mood: 'calm', niche: 'nature', duration: 5 },
  { id: 'vid-jelly', kind: 'video', title: 'Jellyfish', url: tv('Jellyfish'), thumb: unsplash('1514525253161-7a46d19cd819', 400, 400), mood: 'calm', niche: 'nature', duration: 10 },
  { id: 'vid-sintel', kind: 'video', title: 'Sintel', url: tv('Sintel'), thumb: unsplash('1535016120720-40c646be5580', 400, 400), mood: 'premium', niche: 'lifestyle', duration: 10 },
  { id: 'vid-bunny', kind: 'video', title: 'Big Buck Bunny', url: 'https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/360/Big_Buck_Bunny_360_10s_1MB.mp4', thumb: unsplash('1470071459604-3b5ec3a7fe05', 400, 400), mood: 'energetic', niche: 'lifestyle', duration: 10 },
  { id: 'vid-sample', kind: 'video', title: 'City', url: 'https://download.samplelib.com/mp4/sample-10s.mp4', thumb: unsplash('1519389950473-47ba0277781c', 400, 400), mood: 'corporate', niche: 'business', duration: 10 },
];

/** Sample file returned by the mock render service. */
export const mockRenderUrl = tv('Jellyfish');
