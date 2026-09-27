/**
 * Beat-synced effects presets — shared by the backend (FFmpeg filters) and the frontend (UI defaults).
 * Plain JS with types in effects.d.ts.
 */

export const BEAT_FX = ['none', 'soft', 'medium', 'energetic'];

/** Default preset by project mood: calm → soft, energetic → energetic, premium → soft, corporate → none. */
const BY_MOOD = { calm: 'soft', energetic: 'energetic', premium: 'soft', corporate: 'none' };

export function defaultBeatFx(mood) {
  return BY_MOOD[mood] ?? 'none';
}

/** Explicit style.beatFx wins; otherwise the default for the mood. */
export function beatFxOf(project) {
  const v = project.style?.beatFx;
  return BEAT_FX.includes(v) ? v : defaultBeatFx(project.mood);
}

/**
 * Intensities per preset. `every` = use every n-th beat; 0 disables an effect.
 * soft: light punch + colour pulse only; energetic: all effects incl. RGB glitch.
 */
export const FX_PRESETS = {
  none: null,
  soft: { every: 2, width: 0.26, punch: 0.03, shake: 0, flash: 0, flashEvery: 0, color: 0.25, hue: 0, glitchEvery: 0 },
  medium: { every: 1, width: 0.22, punch: 0.05, shake: 0.006, flash: 0.08, flashEvery: 2, color: 0.35, hue: 0.06, glitchEvery: 0 },
  energetic: { every: 1, width: 0.2, punch: 0.08, shake: 0.012, flash: 0.15, flashEvery: 2, color: 0.45, hue: 0.12, glitchEvery: 4 },
};
