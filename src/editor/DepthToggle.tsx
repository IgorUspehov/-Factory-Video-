import { Layers, Loader2, RotateCcw } from 'lucide-react';
import { useEditor } from './EditorContext';
import { useI18n } from '../i18n';

/** Prominent switch for 2.5D parallax + live status of the in-browser depth computation. */
export function DepthToggle() {
  const { project, update, depth, retryDepth } = useEditor();
  const { t } = useI18n();
  const on = !!project.style.parallax;
  const photos = project.media.filter((m) => m.kind === 'image');
  const ready = photos.filter((m) => m.depth).length;

  const toggle = () => {
    if (!on && depth.phase === 'error') retryDepth();
    update((p) => ({ style: { ...p.style, parallax: !on } }));
  };

  let status: string | null = null;
  if (on && depth.phase === 'model') status = t('depth.loadingModel', { pct: depth.modelPercent });
  else if (on && depth.phase === 'running') status = t('depth.progress', { done: Math.min(depth.done + 1, depth.total), total: depth.total });
  else if (on && photos.length) status = t('depth.ready', { n: ready, total: photos.length });

  return (
    <div className={`rounded-2xl border p-4 ${on ? 'border-accent/60 bg-accent/[0.06]' : 'border-line'}`}>
      <label className="flex min-h-[44px] cursor-pointer items-center justify-between gap-3" title={t('depth.hint')}>
        <span className="flex items-center gap-3">
          <span className="icon-tile h-10 w-10">
            <Layers size={18} />
          </span>
          <span>
            <span className="block font-semibold">{t('depth.title')}</span>
            <span className="block text-[13px] leading-snug text-muted">{t('depth.hint')}</span>
          </span>
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label={t('depth.title')}
          onClick={toggle}
          className={`relative h-7 w-12 shrink-0 rounded-full transition ${on ? 'bg-accent shadow-glow-sm' : 'bg-line'}`}
        >
          <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white transition-all ${on ? 'left-[22px]' : 'left-0.5'}`} />
        </button>
      </label>
      {on && (
        <div className="mt-3 space-y-2 text-[13px]" aria-live="polite">
          {status && (
            <p className="flex items-center gap-2" data-testid="depth-status">
              {(depth.phase === 'model' || depth.phase === 'running') && <Loader2 size={14} className="animate-spin text-accent" />}
              {status}
            </p>
          )}
          {depth.phase === 'running' && depth.total > 0 && (
            <div className="h-1.5 overflow-hidden rounded-full bg-bg">
              <div className="glow-line h-full transition-all" style={{ width: `${(depth.done / depth.total) * 100}%` }} />
            </div>
          )}
          {depth.phase === 'model' && <p className="text-muted">{t('depth.modelNote')}</p>}
          {depth.phase === 'error' && (
            <div className="rounded-xl border border-amber-500/50 bg-amber-500/10 p-3">
              <p className="text-amber-100">{t('depth.error')}</p>
              <button type="button" className="btn-secondary btn-sm mt-2" onClick={retryDepth}>
                <RotateCcw size={14} /> {t('depth.retry')}
              </button>
            </div>
          )}
          {depth.failed > 0 && depth.phase !== 'error' && <p className="text-muted">{t('depth.someFailed', { n: depth.failed })}</p>}
          {project.media.some((m) => m.kind === 'video') && <p className="text-muted">{t('depth.videosNote')}</p>}
        </div>
      )}
    </div>
  );
}
