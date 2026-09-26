import { Clapperboard } from 'lucide-react';
import { useI18n } from '../i18n';
import { aspectClass, statusKey } from '../lib/labels';
import { isMockMode } from '../lib/api';
import type { Format, RenderState } from '../types';

/** Player for a finished render; shows progress while the job is running. */
export function RenderPlayer({ render, format, className = '' }: { render: RenderState; format: Format; className?: string }) {
  const { t } = useI18n();
  const running = render.status === 'queued' || render.status === 'rendering';
  return (
    <div className={`relative mx-auto overflow-hidden rounded-[18px] border border-line bg-black ${aspectClass[format]} ${className}`}>
      {render.status === 'done' && render.url ? (
        <>
          <video src={render.url} controls playsInline className="h-full w-full object-contain" />
          {/* the real backend burns the watermark into the MP4; the mock sample video needs an overlay */}
          {render.watermark && isMockMode() && (
            <span className="pointer-events-none absolute bottom-12 right-3 rounded-md bg-black/40 px-2 py-1 font-display text-[11px] font-extrabold tracking-tight text-white/70">
              Factory <span className="text-accent-light">Video</span>
            </span>
          )}
        </>
      ) : (
        <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
          <span className={`icon-tile h-14 w-14 rounded-2xl ${running ? 'animate-pulse-glow shadow-glow' : ''}`}>
            <Clapperboard size={24} />
          </span>
          <div className="text-sm font-semibold">{t(statusKey[render.status])}</div>
          {running && (
            <div className="w-40">
              <div className="h-1.5 overflow-hidden rounded-full bg-line">
                <div className="glow-line h-full transition-all" style={{ width: `${render.progress}%` }} />
              </div>
              <div className="mt-1 text-xs tabular-nums text-muted">{render.progress}%</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
