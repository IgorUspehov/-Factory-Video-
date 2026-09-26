export type LengthMode = 'timeline' | 'track' | number;

export interface TimelineProjectLike {
  goal?: string;
  lengthMode?: LengthMode;
  audio?: { source: string; duration: number; beats?: number[] } | null;
  media?: { id: string }[];
  timeline?: { mediaId: string; duration: number }[];
  style?: { beatSync?: boolean };
}

export interface EffectiveClip {
  mediaId: string;
  duration: number;
}

export declare const MAX_VIDEO_SECONDS: number;
export declare const LENGTH_PRESETS: number[];
export declare function renderCost(durationSec: number): number;
export declare function defaultLengthMode(goal?: string): LengthMode;
export declare function lengthModeOf(project: TimelineProjectLike): LengthMode;
export declare function trackDuration(project: TimelineProjectLike): number;
export declare function snapToBeats(durations: number[], beats: number[] | undefined | null): number[];
export declare function effectiveTimeline(project: TimelineProjectLike): { clips: EffectiveClip[]; total: number; mode: LengthMode; target: number };
export declare function plannedDuration(project: TimelineProjectLike): number;
