export type BeatFx = 'none' | 'soft' | 'medium' | 'energetic';

export interface FxPreset {
  every: number;
  width: number;
  punch: number;
  shake: number;
  flash: number;
  flashEvery: number;
  color: number;
  hue: number;
  glitchEvery: number;
}

export declare const BEAT_FX: BeatFx[];
export declare const FX_PRESETS: Record<BeatFx, FxPreset | null>;
export declare function defaultBeatFx(mood?: string): BeatFx;
export declare function beatFxOf(project: { mood?: string; style?: { beatFx?: string } }): BeatFx;
