export type Plan = 'free' | 'pro';

export interface User {
  id: string;
  email: string;
  plan: Plan;
  credits: number;
  renewsAt: string | null;
}

export type Goal = 'clip' | 'promo' | 'reels';
export type Format = '9:16' | '16:9' | '1:1';
export type Mood = 'calm' | 'energetic' | 'premium' | 'corporate';
export type Niche = 'music' | 'business' | 'lifestyle' | 'tech' | 'nature';
export type NodeKind = 'audio' | 'visual' | 'text' | 'style' | 'montage' | 'output';
export type TextMode = 'titles' | 'slogan' | 'lyrics';
export type Transition = 'cut' | 'fade' | 'zoom' | 'slide';
export type RenderStatus = 'idle' | 'queued' | 'rendering' | 'done' | 'failed';

export interface AudioTrack {
  source: 'upload' | 'library' | 'none';
  id?: string;
  name?: string;
  url?: string;
  duration: number;
  bpm?: number;
  beats: number[];
  peaks: number[];
  rightsConfirmed?: boolean;
}

export interface MediaItem {
  id: string;
  kind: 'image' | 'video';
  url: string;
  thumb: string;
  name: string;
  duration?: number;
  source: 'upload' | 'library';
}

export interface LyricLine {
  id: string;
  text: string;
  start: number;
  end: number;
}

export interface StyleSettings {
  background: string;
  accent: string;
  text: string;
  font: string;
  transition: Transition;
  kenBurns: boolean;
  beatSync: boolean;
  audioFadeIn: boolean;
  audioFadeOut: boolean;
}

export interface TimelineClip {
  id: string;
  mediaId: string;
  duration: number;
}

export interface RenderState {
  jobId?: string;
  status: RenderStatus;
  progress: number;
  url?: string;
  expiresAt?: string;
  watermark?: boolean;
  cost?: number;
  format?: Format;
}

export interface FlowNodeData {
  id: string;
  type: NodeKind;
  position: { x: number; y: number };
}

export interface FlowEdgeData {
  id: string;
  source: string;
  target: string;
}

export interface Project {
  id: string;
  title: string;
  goal: Goal;
  format: Format;
  mood: Mood;
  textMode: TextMode;
  nodes: FlowNodeData[];
  edges: FlowEdgeData[];
  audio: AudioTrack | null;
  media: MediaItem[];
  lyrics: LyricLine[];
  style: StyleSettings;
  timeline: TimelineClip[];
  render: RenderState;
  createdAt: string;
  updatedAt: string;
}

export type ProjectDraft = Omit<Project, 'id' | 'createdAt' | 'updatedAt'>;

export interface LibraryTrack {
  id: string;
  title: string;
  artist: string;
  mood: Mood;
  niche: Niche;
  duration: number;
  bpm: number;
  url: string;
}

export interface LibraryMedia {
  id: string;
  kind: 'image' | 'video';
  title: string;
  url: string;
  thumb: string;
  mood: Mood;
  niche: Niche;
  duration?: number;
}

export interface UploadResult {
  id: string;
  url: string;
  name: string;
  size: number;
}

export interface AudioAnalysis {
  duration: number;
  bpm: number;
  beats: number[];
  peaks?: number[];
}

export interface RenderJob {
  jobId: string;
  cost: number;
}

export interface RenderStatusResponse {
  status: RenderStatus;
  progress: number;
  url: string | null;
  expiresAt: string | null;
  watermark: boolean;
}

export interface BillingHistoryItem {
  id: string;
  date: string;
  projectId: string;
  projectTitle: string;
  format: Format;
  credits: number;
  status: RenderStatus;
}
