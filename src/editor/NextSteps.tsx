import { useEffect, useRef, useState } from 'react';
import { Check, Clapperboard, Image as ImageIcon, Loader2, Music, Play, type LucideIcon } from 'lucide-react';
import { useEditor } from './EditorContext';
import { useI18n, type TKey } from '../i18n';
import type { NodeKind } from '../types';

interface Step {
  node: NodeKind;
  icon: LucideIcon;
  label: TKey;
  hint: TKey;
  done: boolean;
}

/** "What to do next": 3 steps over the canvas; the current one is highlighted, then one big build button. */
export function NextSteps() {
  const { project, select, selected, startRender, renderStarting, setPlayerOpen } = useEditor();
  const { t } = useI18n();
  const r = project.render;
  const running = r.status === 'queued' || r.status === 'rendering';
  const steps: Step[] = [
    { node: 'audio', icon: Music, label: 'steps.music', hint: 'steps.musicHint', done: !!project.audio },
    { node: 'visual', icon: ImageIcon, label: 'steps.visuals', hint: 'steps.visualsHint', done: project.media.length > 0 },
    { node: 'output', icon: Clapperboard, label: 'steps.build', hint: 'steps.buildHint', done: r.status === 'done' },
  ];
  const current = steps.findIndex((s) => !s.done);
  // the canvas column width depends on the resizable panel, so measure it instead of using viewport breakpoints
  const ref = useRef<HTMLDivElement>(null);
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWide(entry.contentRect.width >= 780));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const ready = steps[0].done && steps[1].done;

  return (
    <div ref={ref} className="flex shrink-0 justify-center border-b border-line bg-card/40 p-2 sm:px-4">
      <div className={`flex w-full max-w-5xl gap-2 ${wide ? 'flex-row items-center' : 'flex-col'}`}>
        <span className="label-caps hidden shrink-0 px-2 2xl:block">{t('steps.title')}</span>
        <ol className="grid flex-1 grid-cols-3 gap-1.5">
          {steps.map((s, i) => {
            const active = i === current;
            return (
              <li key={s.node}>
                <button
                  type="button"
                  onClick={() => select(s.node)}
                  title={t(s.hint)}
                  aria-current={active ? 'step' : undefined}
                  className={`flex h-full min-h-[48px] w-full items-center gap-2 rounded-xl border px-2 py-1.5 text-left transition sm:px-3 ${
                    active
                      ? 'border-accent bg-accent/15 shadow-glow-sm'
                      : selected === s.node
                        ? 'border-accent/50 bg-white/[0.03]'
                        : 'border-transparent hover:bg-white/5'
                  }`}
                >
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px] font-bold ${
                      s.done ? 'bg-accent text-white' : active ? 'border-2 border-accent text-accent-light' : 'border border-line text-muted'
                    }`}
                  >
                    {s.done ? <Check size={15} strokeWidth={3} /> : i + 1}
                  </span>
                  <span className="min-w-0">
                    <span className={`block text-[12px] font-semibold leading-tight sm:text-[13px] ${s.done || active ? 'text-white' : 'text-muted'}`}>{t(s.label)}</span>
                    <span className="hidden truncate text-[12px] text-muted 2xl:block">{t(s.hint)}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>

        {running ? (
          <div className="flex min-h-[48px] min-w-[220px] flex-col justify-center rounded-xl border border-accent/60 bg-accent/10 px-4 py-2" role="status" aria-live="polite">
            <div className="flex items-center justify-between gap-3 text-sm font-semibold">
              <span className="flex items-center gap-2">
                <Loader2 size={16} className="animate-spin text-accent" />
                {r.status === 'queued' ? t('render.status.queued') : t('steps.rendering')}
              </span>
              <span className="font-display text-lg tabular-nums">{r.status === 'queued' ? '…' : `${r.progress}%`}</span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-bg">
              <div className="glow-line h-full rounded-full transition-all duration-500" style={{ width: `${r.status === 'queued' ? 3 : r.progress}%` }} />
            </div>
          </div>
        ) : r.status === 'done' && r.url ? (
          <div className="flex gap-2">
            <button className="btn-primary min-h-[48px] flex-1 px-5" onClick={() => setPlayerOpen(true)} title={t('steps.watchHint')}>
              <Play size={16} className="fill-white" /> {t('steps.watch')}
            </button>
            <button className="btn-secondary min-h-[48px] px-4" onClick={() => void startRender()} disabled={renderStarting} title={t('steps.rebuildHint')}>
              {t('steps.rebuild')}
            </button>
          </div>
        ) : (
          <button
            className="btn-primary min-h-[48px] px-6 text-base"
            onClick={() => (ready ? void startRender() : select(steps[current]?.node ?? 'output'))}
            disabled={renderStarting}
            title={ready ? t('steps.buildNowHint') : t('steps.notReady')}
          >
            {ready ? (
              <>
                {t('steps.buildNow')} <Play size={16} className="fill-white" />
              </>
            ) : (
              <>{t('steps.next')} →</>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
