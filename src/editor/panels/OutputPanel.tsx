import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, ExternalLink, Link2, Play, Zap } from 'lucide-react';
import { useEditor } from '../EditorContext';
import { useI18n } from '../../i18n';
import { useAuth } from '../../lib/auth';
import { api } from '../../lib/api';
import { copyText } from '../../lib/share';
import { useCheckout } from '../../lib/useCheckout';
import { renderCost } from '../../config/pricing';
import { FORMATS, formatKey, statusKey } from '../../lib/labels';
import { MAX_VIDEO_SECONDS, projectDuration } from '../../lib/project';
import { LengthPicker } from '../LengthPicker';
import { Hint } from '../../components/Hint';
import { RenderPlayer } from '../../components/RenderPlayer';
import { WatermarkNotice } from '../../components/WatermarkNotice';

export function OutputPanel() {
  const { project, update, startRender, renderStarting, renderError, setPlayerOpen } = useEditor();
  const { user } = useAuth();
  const { t, formatDate } = useI18n();
  const { checkout, busy } = useCheckout();
  const [copied, setCopied] = useState(false);
  const duration = projectDuration(project);
  const tooLong = duration > MAX_VIDEO_SECONDS;
  const cost = renderCost(duration || 15);
  const credits = user?.credits ?? 0;
  const enough = credits >= cost;
  const r = project.render;
  const running = r.status === 'queued' || r.status === 'rendering';
  const empty = project.media.length === 0 && (!project.audio || project.audio.source === 'none');

  const getLink = async () => {
    if (!r.jobId) return;
    const link = await api.renderLink(r.jobId);
    update({ render: { ...r, url: link.url, expiresAt: link.expiresAt } });
    setCopied(await copyText(link.url));
    window.setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="space-y-5">
      <div>
        <div className="label-caps mb-2">{t('output.format')}</div>
        <div className="grid grid-cols-3 gap-1 rounded-xl border border-line bg-bg p-1">
          {FORMATS.map((f) => (
            <button
              key={f}
              onClick={() => update({ format: f })}
              disabled={running}
              className={`rounded-lg py-2 text-xs font-semibold transition ${project.format === f ? 'bg-accent/15 text-accent-light' : 'text-muted hover:text-white'}`}
              title={t(formatKey[f])}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <LengthPicker />

      <div className="grid grid-cols-2 gap-2 text-center">
        <div className="rounded-xl border border-accent/50 p-3 shadow-glow-sm" title={t('output.costHint')}>
          <div className="label-caps">{t('output.cost')}</div>
          <div className="mt-1 inline-flex items-center gap-1 font-display text-xl font-extrabold tabular-nums">
            <Zap size={15} className="fill-accent text-accent" />
            {cost}
          </div>
        </div>
        <div className="rounded-xl border border-line p-3" title={t('output.balanceHint')}>
          <div className="label-caps">{t('output.balance')}</div>
          <div className="mt-1 font-display text-xl font-extrabold tabular-nums">{credits}</div>
        </div>
      </div>
      <Hint>{t('output.costExplain')}</Hint>

      {user?.plan === 'free' && <WatermarkNotice compact />}

      <button
        className="btn-primary w-full py-3.5 text-base"
        disabled={!enough || running || renderStarting || empty || tooLong}
        onClick={() => void startRender()}
        title={t('steps.buildNowHint')}
      >
        <Play size={16} className="fill-white" /> {t('steps.buildNow')}
      </button>
      {empty && <p className="text-center text-xs text-muted">{t('output.needMaterial')}</p>}
      {(!enough || renderError === 'credits') && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-center text-sm">
          <p className="text-red-200">{t('output.notEnough', { cost, credits })}</p>
          <button className="btn-secondary btn-sm mt-3" disabled={busy} onClick={() => checkout('credits')}>
            <Zap size={14} /> {t('output.topUp')}
          </button>
        </div>
      )}
      {renderError === 'generic' && <p className="text-sm text-red-300">{t('auth.errors.generic')}</p>}
      {renderError === 'too_long' && <p className="text-sm text-red-300">{t('length.tooLongServer')}</p>}

      {r.status !== 'idle' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="label-caps">{t('output.status')}</span>
            <span className={r.status === 'done' ? 'text-accent-light' : 'text-white'}>
              {t(statusKey[r.status])}
              {r.status === 'rendering' ? ` · ${r.progress}%` : ''}
            </span>
          </div>
          <RenderPlayer render={r} format={r.format ?? project.format} className={project.format === '9:16' ? 'max-w-[220px]' : ''} />
          {r.status === 'done' && r.url && (
            <>
              <button className="btn-primary w-full" onClick={() => setPlayerOpen(true)} title={t('steps.watchHint')}>
                <Play size={16} className="fill-white" /> {t('steps.watch')}
              </button>
              <div className="grid grid-cols-2 gap-2">
                <a className="btn-primary btn-sm" href={r.url} download={`${project.title}.mp4`} target="_blank" rel="noreferrer">
                  <Download size={14} /> {t('output.download')}
                </a>
                <button className="btn-secondary btn-sm" onClick={() => void getLink()}>
                  <Link2 size={14} /> {copied ? t('common.copied') : t('output.getLink')}
                </button>
              </div>
              {r.expiresAt && <p className="text-center text-[11px] text-muted">{t('export.validUntil', { date: formatDate(r.expiresAt, true) })}</p>}
              <Link to={`/export/${project.id}`} className="btn-ghost btn-sm w-full">
                <ExternalLink size={14} /> {t('output.openExport')}
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  );
}
