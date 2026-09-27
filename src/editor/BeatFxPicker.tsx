import { Zap } from 'lucide-react';
import { useEditor } from './EditorContext';
import { useI18n, type TKey } from '../i18n';
import { Hint } from '../components/Hint';
import { BEAT_FX, beatFxOf } from '../../server/src/shared/effects.js';
import type { BeatFx } from '../types';

export const beatFxKey: Record<BeatFx, TKey> = {
  none: 'beatFx.none',
  soft: 'beatFx.soft',
  medium: 'beatFx.medium',
  energetic: 'beatFx.energetic',
};
const hintKey: Record<BeatFx, TKey> = {
  none: 'beatFx.noneHint',
  soft: 'beatFx.softHint',
  medium: 'beatFx.mediumHint',
  energetic: 'beatFx.energeticHint',
};

/** Beat-synced effects preset — shown next to the video length. */
export function BeatFxPicker() {
  const { project, update } = useEditor();
  const { t } = useI18n();
  const current = beatFxOf(project);
  const hasBeats = !!project.audio && project.audio.source !== 'none' && project.audio.beats.length > 0;

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <Zap size={14} className="text-accent" />
        <span className="label-caps">{t('beatFx.title')}</span>
      </div>
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={t('beatFx.title')}>
        {BEAT_FX.map((fx) => (
          <button
            key={fx}
            type="button"
            role="radio"
            aria-checked={current === fx}
            title={t(hintKey[fx])}
            onClick={() => update((p) => ({ style: { ...p.style, beatFx: fx } }))}
            className={`chip ${current === fx ? 'chip-active' : ''}`}
          >
            {t(beatFxKey[fx])}
          </button>
        ))}
      </div>
      <Hint>{hasBeats ? `${t('beatFx.hint')} ${t(hintKey[current])}` : t('beatFx.needsBeats')}</Hint>
    </div>
  );
}
