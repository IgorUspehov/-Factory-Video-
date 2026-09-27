import { ArrowDown, ArrowUp, AudioWaveform, Film, MoveHorizontal } from 'lucide-react';
import { useEditor } from '../EditorContext';
import { useI18n } from '../../i18n';
import { effectiveTimeline, formatClock, lengthModeOf, snapToBeats, trackDuration } from '../../lib/project';
import { LengthPicker } from '../LengthPicker';
import { BeatFxPicker } from '../BeatFxPicker';
import { Advanced, Hint } from '../../components/Hint';
import type { TimelineClip } from '../../types';

export function MontagePanel() {
  const { project, update, select } = useEditor();
  const { t } = useI18n();
  const media = new Map(project.media.map((m) => [m.id, m]));
  const audio = project.audio && project.audio.source !== 'none' ? project.audio : null;
  const plan = effectiveTimeline(project);
  const mode = lengthModeOf(project);
  const track = trackDuration(project);

  const setClips = (timeline: TimelineClip[]) => update({ timeline });
  const move = (from: number, to: number) => {
    if (to < 0 || to >= project.timeline.length) return;
    const next = [...project.timeline];
    const [c] = next.splice(from, 1);
    next.splice(to, 0, c);
    setClips(next);
  };
  const setDuration = (id: string, value: string) => {
    const d = Math.min(60, Math.max(0.5, Math.round((parseFloat(value.replace(',', '.')) || 0.5) * 10) / 10));
    setClips(project.timeline.map((c) => (c.id === id ? { ...c, duration: d } : c)));
  };

  if (project.timeline.length === 0) {
    return (
      <div className="space-y-5">
        <LengthPicker />
        <BeatFxPicker />
        <div className="rounded-2xl border border-dashed border-line p-6 text-center">
          <Film size={22} className="mx-auto text-accent-light" />
          <p className="mt-3 text-muted">{t('montage.empty')}</p>
          <button className="btn-primary btn-sm mt-4" onClick={() => select('visual')}>
            {t('montage.addMedia')} →
          </button>
        </div>
      </div>
    );
  }

  const repeats = plan.clips.length > project.timeline.length;

  return (
    <div className="space-y-5">
      <Hint>{t('montage.intro')}</Hint>
      <LengthPicker />
      <BeatFxPicker />

      <button
        type="button"
        className="btn-secondary w-full"
        disabled={!track || mode === 'track'}
        onClick={() => update({ lengthMode: 'track' })}
        title={t('montage.stretchHint')}
      >
        <MoveHorizontal size={16} /> {mode === 'track' ? t('montage.stretched') : t('montage.stretch')}
      </button>
      {!track && <Hint>{t('montage.stretchNoTrack')}</Hint>}

      <div className="rounded-2xl border border-line bg-bg p-3">
        <div className="flex items-center justify-between text-[13px]">
          <span className="text-muted">{t('montage.shots', { n: plan.clips.length })}</span>
          <span className="font-semibold tabular-nums">{formatClock(plan.total)}</span>
        </div>
        <div className="mt-2 flex h-12 gap-px overflow-hidden rounded-lg">
          {plan.clips.map((c, i) => {
            const m = media.get(c.mediaId);
            return (
              <div
                key={i}
                className="relative min-w-[3px] overflow-hidden"
                style={{ flexGrow: c.duration, backgroundImage: m?.thumb ? `url(${m.thumb})` : undefined, backgroundSize: 'cover', backgroundPosition: 'center' }}
                title={`${i + 1} · ${c.duration.toFixed(1)} s`}
              >
                <span className="absolute inset-0 bg-accent/20" />
              </div>
            );
          })}
        </div>
        {audio && (
          <div className="mt-2 flex items-center gap-2 text-[12px] text-muted">
            <AudioWaveform size={12} className="text-accent-light" />
            {t('montage.audioLength', { time: formatClock(audio.duration) })}
            {project.style.beatSync && audio.beats.length > 0 && ` · ${t('montage.onBeat')}`}
          </div>
        )}
        {repeats && <Hint>{t('montage.repeatNote', { n: project.timeline.length })}</Hint>}
      </div>

      <Advanced note={t('montage.advancedNote')}>
        <Hint>{mode === 'timeline' ? t('montage.durationsExact') : t('montage.durationsAverage')}</Hint>
        {audio?.bpm ? (
          <button className="btn-secondary btn-sm" onClick={() => setClips(snapToBeats(project.timeline, audio.bpm!))} title={t('montage.snapHint')}>
            <AudioWaveform size={14} /> {t('montage.snap', { bpm: audio.bpm })}
          </button>
        ) : null}
        <ol className="space-y-2">
          {project.timeline.map((c, i) => {
            const m = media.get(c.mediaId);
            return (
              <li key={c.id} className="flex items-center gap-2 rounded-xl border border-line p-2">
                <span className="w-5 text-center text-xs font-bold tabular-nums text-muted">{i + 1}</span>
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-bg">{m?.thumb && <img src={m.thumb} alt="" className="h-full w-full object-cover" />}</div>
                <div className="min-w-0 flex-1 truncate text-[13px]">{m?.name}</div>
                <label className="flex items-center gap-1 text-[13px] text-muted" title={t('montage.duration')}>
                  <input
                    className="input w-16 px-2 py-1.5 text-center tabular-nums"
                    inputMode="decimal"
                    defaultValue={c.duration}
                    key={`${c.id}-${c.duration}`}
                    onBlur={(e) => setDuration(c.id, e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                    aria-label={t('montage.duration')}
                  />
                  s
                </label>
                <div className="flex flex-col">
                  <button className="rounded p-1 text-muted hover:text-white disabled:opacity-30" disabled={i === 0} onClick={() => move(i, i - 1)} aria-label={t('common.moveUp')} title={t('common.moveUp')}>
                    <ArrowUp size={15} />
                  </button>
                  <button
                    className="rounded p-1 text-muted hover:text-white disabled:opacity-30"
                    disabled={i === project.timeline.length - 1}
                    onClick={() => move(i, i + 1)}
                    aria-label={t('common.moveDown')}
                    title={t('common.moveDown')}
                  >
                    <ArrowDown size={15} />
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
      </Advanced>
    </div>
  );
}
