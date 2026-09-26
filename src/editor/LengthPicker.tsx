import { AlertTriangle, Scissors } from 'lucide-react';
import { useEditor } from './EditorContext';
import { useI18n } from '../i18n';
import { effectiveTimeline, formatClock, LENGTH_PRESETS, lengthModeOf, MAX_VIDEO_SECONDS, trackDuration } from '../lib/project';
import { Hint } from '../components/Hint';
import type { LengthMode } from '../types';

/** Video length: whole track / 15 / 30 / 60 s / by montage. Shared by the Montage and Output panels. */
export function LengthPicker() {
  const { project, update } = useEditor();
  const { t } = useI18n();
  const mode = lengthModeOf(project);
  const track = trackDuration(project);
  const { total } = effectiveTimeline(project);
  const tooLong = total > MAX_VIDEO_SECONDS;

  const options: { value: LengthMode; label: string; title: string; disabled?: boolean }[] = [
    { value: 'track', label: t('length.track'), title: t('length.trackHint'), disabled: !track },
    ...LENGTH_PRESETS.map((s) => ({ value: s, label: t('length.seconds', { n: s }), title: t('length.presetHint', { n: s }) })),
    { value: 'timeline', label: t('length.timeline'), title: t('length.timelineHint') },
  ];
  const custom = typeof mode === 'number' && !LENGTH_PRESETS.includes(mode);

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <span className="label-caps">{t('length.title')}</span>
        <span className="font-display text-lg font-extrabold tabular-nums">{formatClock(total)}</span>
      </div>
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={t('length.title')}>
        {options.map((o) => (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={mode === o.value}
            disabled={o.disabled}
            title={o.title}
            onClick={() => update({ lengthMode: o.value })}
            className={`chip ${mode === o.value ? 'chip-active' : ''} disabled:opacity-40`}
          >
            {o.label}
            {o.value === 'track' && track ? ` · ${formatClock(track)}` : ''}
          </button>
        ))}
        {custom && (
          <span className="chip chip-active" role="radio" aria-checked>
            {t('length.seconds', { n: mode as number })}
          </span>
        )}
      </div>
      <Hint>
        {mode === 'track'
          ? t('length.trackExplain')
          : mode === 'timeline'
            ? t('length.timelineExplain')
            : t('length.presetExplain', { n: mode as number })}
      </Hint>
      {tooLong && (
        <div className="mt-3 rounded-xl border border-amber-500/50 bg-amber-500/10 p-3 text-sm">
          <p className="flex items-start gap-2 text-amber-100">
            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-400" />
            {t('length.tooLong', { max: formatClock(MAX_VIDEO_SECONDS), length: formatClock(total) })}
          </p>
          <button type="button" className="btn-secondary btn-sm mt-3" onClick={() => update({ lengthMode: MAX_VIDEO_SECONDS })}>
            <Scissors size={14} /> {t('length.trim', { max: formatClock(MAX_VIDEO_SECONDS) })}
          </button>
        </div>
      )}
    </div>
  );
}
