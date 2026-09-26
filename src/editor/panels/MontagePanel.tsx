import { ArrowDown, ArrowUp, AudioWaveform, Film, MoveHorizontal } from 'lucide-react';
import { useEditor } from '../EditorContext';
import { useI18n } from '../../i18n';
import { formatClock, projectDuration, snapToBeats } from '../../lib/project';
import type { TimelineClip } from '../../types';

export function MontagePanel() {
  const { project, update, select } = useEditor();
  const { t } = useI18n();
  const total = projectDuration(project);
  const media = new Map(project.media.map((m) => [m.id, m]));
  const audio = project.audio && project.audio.source !== 'none' ? project.audio : null;

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
  const fitToAudio = () => {
    if (!audio || project.timeline.length === 0) return;
    const target = Math.min(audio.duration, 180);
    const each = Math.round((target / project.timeline.length) * 10) / 10;
    setClips(project.timeline.map((c) => ({ ...c, duration: Math.max(0.5, each) })));
  };

  if (project.timeline.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-line p-6 text-center">
        <Film size={22} className="mx-auto text-accent-light" />
        <p className="mt-3 text-sm text-muted">{t('montage.empty')}</p>
        <button className="btn-secondary btn-sm mt-4" onClick={() => select('visual')}>
          {t('montage.addMedia')} →
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-line bg-bg p-3">
        <div className="flex items-center justify-between text-xs">
          <span className="label-caps">{t('montage.total')}</span>
          <span className="font-display text-lg font-extrabold tabular-nums">{formatClock(total)}</span>
        </div>
        <div className="mt-3 flex h-10 gap-0.5 overflow-hidden rounded-lg">
          {project.timeline.map((c, i) => {
            const m = media.get(c.mediaId);
            return (
              <div
                key={c.id}
                className="relative min-w-[6px] overflow-hidden border-r border-bg"
                style={{ flexGrow: c.duration, backgroundImage: m?.thumb ? `url(${m.thumb})` : undefined, backgroundSize: 'cover', backgroundPosition: 'center' }}
                title={`${i + 1} · ${c.duration}s`}
              >
                <span className="absolute inset-0 bg-accent/25" />
              </div>
            );
          })}
        </div>
        {audio && (
          <div className="mt-2 flex items-center gap-2 text-[11px] text-muted">
            <AudioWaveform size={12} className="text-accent-light" />
            {t('montage.audioLength', { time: formatClock(audio.duration) })}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {audio?.bpm && (
          <button className="btn-secondary btn-sm" onClick={() => setClips(snapToBeats(project.timeline, audio.bpm!))}>
            <AudioWaveform size={14} /> {t('montage.snap', { bpm: audio.bpm })}
          </button>
        )}
        {audio && (
          <button className="btn-ghost btn-sm" onClick={fitToAudio}>
            <MoveHorizontal size={14} /> {t('montage.fit')}
          </button>
        )}
      </div>

      <ol className="space-y-2">
        {project.timeline.map((c, i) => {
          const m = media.get(c.mediaId);
          return (
            <li key={c.id} className="flex items-center gap-2 rounded-xl border border-line p-2">
              <span className="w-5 text-center text-xs font-bold tabular-nums text-muted">{i + 1}</span>
              <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-bg">{m?.thumb && <img src={m.thumb} alt="" className="h-full w-full object-cover" />}</div>
              <div className="min-w-0 flex-1 truncate text-xs">{m?.name}</div>
              <label className="flex items-center gap-1 text-xs text-muted">
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
                <button className="rounded p-0.5 text-muted hover:text-white disabled:opacity-30" disabled={i === 0} onClick={() => move(i, i - 1)} aria-label={t('common.moveUp')}>
                  <ArrowUp size={13} />
                </button>
                <button
                  className="rounded p-0.5 text-muted hover:text-white disabled:opacity-30"
                  disabled={i === project.timeline.length - 1}
                  onClick={() => move(i, i + 1)}
                  aria-label={t('common.moveDown')}
                >
                  <ArrowDown size={13} />
                </button>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
