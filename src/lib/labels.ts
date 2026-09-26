import type { TKey } from '../i18n';
import type { Format, Goal, Mood, Niche, NodeKind, RenderStatus, TextMode, Transition } from '../types';

export const statusKey: Record<RenderStatus, TKey> = {
  idle: 'render.status.idle',
  queued: 'render.status.queued',
  rendering: 'render.status.rendering',
  done: 'render.status.done',
  failed: 'render.status.failed',
};

export const goalKey: Record<Goal, TKey> = { clip: 'goals.clip', promo: 'goals.promo', reels: 'goals.reels' };
export const moodKey: Record<Mood, TKey> = { calm: 'moods.calm', energetic: 'moods.energetic', premium: 'moods.premium', corporate: 'moods.corporate' };
export const nicheKey: Record<Niche, TKey> = {
  music: 'niches.music',
  business: 'niches.business',
  lifestyle: 'niches.lifestyle',
  tech: 'niches.tech',
  nature: 'niches.nature',
};
export const formatKey: Record<Format, TKey> = { '9:16': 'formats.vertical', '16:9': 'formats.horizontal', '1:1': 'formats.square' };
export const nodeKey: Record<NodeKind, TKey> = {
  audio: 'blocks.audio',
  visual: 'blocks.visual',
  text: 'blocks.text',
  style: 'blocks.style',
  montage: 'blocks.montage',
  output: 'blocks.output',
};
export const textModeKey: Record<TextMode, TKey> = { titles: 'text.modes.titles', slogan: 'text.modes.slogan', lyrics: 'text.modes.lyrics' };
export const transitionKey: Record<Transition, TKey> = {
  cut: 'style.transitions.cut',
  fade: 'style.transitions.fade',
  zoom: 'style.transitions.zoom',
  slide: 'style.transitions.slide',
};

export const FORMATS: Format[] = ['9:16', '16:9', '1:1'];
export const MOODS: Mood[] = ['calm', 'energetic', 'premium', 'corporate'];
export const NICHES: Niche[] = ['music', 'business', 'lifestyle', 'tech', 'nature'];
export const GOALS: Goal[] = ['clip', 'promo', 'reels'];

export const aspectClass: Record<Format, string> = { '9:16': 'aspect-[9/16]', '16:9': 'aspect-video', '1:1': 'aspect-square' };
