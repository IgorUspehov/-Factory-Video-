import type {
  FlowEdgeData,
  FlowNodeData,
  Format,
  Goal,
  LyricLine,
  MediaItem,
  Mood,
  NodeKind,
  ProjectDraft,
  StyleSettings,
  TextMode,
  TimelineClip,
  Project,
} from '../types';
import { defaultLengthMode, plannedDuration } from '../../server/src/shared/timeline.js';

export const uid = (prefix = 'id') => `${prefix}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-3)}`;

export const NODE_ORDER: NodeKind[] = ['audio', 'visual', 'text', 'style', 'montage', 'output'];

export const GOOGLE_FONTS = [
  'Inter',
  'Montserrat',
  'Roboto',
  'Poppins',
  'Playfair Display',
  'Oswald',
  'Bebas Neue',
  'Raleway',
  'Lora',
  'Caveat',
  'Space Grotesk',
  'Unbounded',
];

export const MOOD_STYLES: Record<Mood, StyleSettings> = {
  calm: { background: '#0E1116', accent: '#7FB7BE', text: '#F2F2F2', font: 'Lora', transition: 'fade', kenBurns: true, beatSync: false, audioFadeIn: true, audioFadeOut: true },
  energetic: { background: '#0B0B0D', accent: '#FF6A1A', text: '#FFFFFF', font: 'Bebas Neue', transition: 'cut', kenBurns: false, beatSync: true, audioFadeIn: false, audioFadeOut: true },
  premium: { background: '#0A0A0A', accent: '#D4AF37', text: '#F5F1E8', font: 'Playfair Display', transition: 'fade', kenBurns: true, beatSync: false, audioFadeIn: true, audioFadeOut: true },
  corporate: { background: '#0F172A', accent: '#3B82F6', text: '#FFFFFF', font: 'Montserrat', transition: 'slide', kenBurns: false, beatSync: false, audioFadeIn: true, audioFadeOut: true },
};

export const GOAL_TEXT_MODE: Record<Goal, TextMode> = { clip: 'lyrics', promo: 'slogan', reels: 'titles' };

export function defaultGraph(): { nodes: FlowNodeData[]; edges: FlowEdgeData[] } {
  // 3 × 2 grid: fits a typical canvas at a readable zoom
  const nodes = NODE_ORDER.map((type, i) => ({ id: type, type, position: { x: (i % 3) * 340, y: Math.floor(i / 3) * 300 } }));
  const edges = NODE_ORDER.slice(1).map((type, i) => ({ id: `e-${NODE_ORDER[i]}-${type}`, source: NODE_ORDER[i], target: type }));
  return { nodes, edges };
}

export interface DraftOptions {
  title: string;
  goal: Goal;
  format: Format;
  mood: Mood;
  starterLines: string[];
}

export function createDraft({ title, goal, format, mood, starterLines }: DraftOptions): ProjectDraft {
  const { nodes, edges } = defaultGraph();
  let t = 0;
  const lyrics: LyricLine[] = starterLines.map((text) => {
    const line = { id: uid('ln'), text, start: t, end: t + 3 };
    t += 3.5;
    return line;
  });
  return {
    title,
    goal,
    format,
    mood,
    textMode: GOAL_TEXT_MODE[goal],
    lengthMode: defaultLengthMode(goal),
    nodes,
    edges,
    audio: null,
    media: [],
    lyrics,
    style: { ...MOOD_STYLES[mood] },
    timeline: [],
    render: { status: 'idle', progress: 0 },
  };
}

/** Keeps timeline order for existing media, drops removed media and appends new items. */
export function syncTimeline(media: MediaItem[], timeline: TimelineClip[]): TimelineClip[] {
  const ids = new Set(media.map((m) => m.id));
  const kept = timeline.filter((c) => ids.has(c.mediaId));
  const present = new Set(kept.map((c) => c.mediaId));
  const added = media
    .filter((m) => !present.has(m.id))
    .map((m) => ({ id: uid('clip'), mediaId: m.id, duration: m.kind === 'video' ? Math.min(m.duration ?? 5, 10) : 3 }));
  return [...kept, ...added];
}

/** Rendered (and billed) length in seconds — identical to the backend (server/src/shared/timeline.js). */
export function projectDuration(p: Project): number {
  return plannedDuration(p);
}

export { effectiveTimeline, lengthModeOf, trackDuration, MAX_VIDEO_SECONDS, LENGTH_PRESETS } from '../../server/src/shared/timeline.js';

/** Snaps clip durations to whole beat intervals (at least one beat). */
export function snapToBeats(timeline: TimelineClip[], bpm: number): TimelineClip[] {
  const beat = 60 / bpm;
  return timeline.map((c) => ({ ...c, duration: Math.round(Math.max(1, Math.round(c.duration / beat)) * beat * 100) / 100 }));
}

export function formatTime(sec: number): string {
  const s = Math.max(0, sec);
  const m = Math.floor(s / 60);
  const r = s - m * 60;
  return `${m}:${r < 10 ? '0' : ''}${r.toFixed(1)}`;
}

export function formatClock(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * Longest-path layering from left to right; nodes without incoming edges start at column 0.
 * With `maxCols` the layers wrap into bands (used on narrow screens).
 */
export function autoLayout(nodes: FlowNodeData[], edges: FlowEdgeData[], maxCols = Infinity): FlowNodeData[] {
  const depth = new Map<string, number>(nodes.map((n) => [n.id, 0]));
  for (let i = 0; i < nodes.length; i++) {
    let changed = false;
    for (const e of edges) {
      const d = (depth.get(e.source) ?? 0) + 1;
      if (depth.has(e.target) && d > (depth.get(e.target) ?? 0) && d < nodes.length) {
        depth.set(e.target, d);
        changed = true;
      }
    }
    if (!changed) break;
  }
  const rows = new Map<number, number>();
  const perLayer = new Map<number, number>();
  for (const n of nodes) perLayer.set(depth.get(n.id) ?? 0, (perLayer.get(depth.get(n.id) ?? 0) ?? 0) + 1);
  const bandHeight = Math.max(1, ...perLayer.values()) * 250 + 60;
  const ordered = [...nodes].sort((a, b) => NODE_ORDER.indexOf(a.type) - NODE_ORDER.indexOf(b.type));
  const placed = new Map<string, { x: number; y: number }>();
  for (const n of ordered) {
    const layer = depth.get(n.id) ?? 0;
    const row = rows.get(layer) ?? 0;
    rows.set(layer, row + 1);
    const col = Number.isFinite(maxCols) ? layer % maxCols : layer;
    const band = Number.isFinite(maxCols) ? Math.floor(layer / maxCols) : 0;
    placed.set(n.id, { x: col * 340, y: band * bandHeight + row * 250 });
  }
  return nodes.map((n) => ({ ...n, position: placed.get(n.id) ?? n.position }));
}
