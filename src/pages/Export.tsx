import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarClock, Copy, Download, RefreshCw, RotateCcw, Share2, Zap } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useRender } from '../lib/useRender';
import { copyText } from '../lib/share';
import { useI18n } from '../i18n';
import { FORMATS, formatKey, statusKey } from '../lib/labels';
import { formatClock, projectDuration } from '../lib/project';
import { renderCost } from '../config/pricing';
import { RenderPlayer } from '../components/RenderPlayer';
import { WatermarkNotice } from '../components/WatermarkNotice';
import { Spinner } from '../components/Spinner';
import type { Format, Project, RenderState } from '../types';

export default function Export() {
  const { projectId = '' } = useParams();
  const { t, formatDate } = useI18n();
  const { user } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [missing, setMissing] = useState(false);
  const [format, setFormat] = useState<Format>('9:16');
  const [note, setNote] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    api
      .getProject(projectId)
      .then((p) => {
        setProject(p);
        setFormat(p.render.format ?? p.format);
      })
      .catch(() => setMissing(true));
  }, [projectId]);

  const onRender = useCallback(
    (render: RenderState) => {
      setProject((p) => (p ? { ...p, render } : p));
      void api.updateProject(projectId, { render }).catch(() => undefined);
    },
    [projectId],
  );
  const { start, starting, error, active } = useRender(project, onRender);

  const flash = (text: string) => {
    setNote(text);
    window.setTimeout(() => setNote(null), 2500);
  };

  if (missing)
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <h1 className="h-display text-2xl">{t('editor.notFound')}</h1>
        <Link to="/projects" className="btn-primary mt-6">
          {t('nav.myProjects')} →
        </Link>
      </div>
    );
  if (!project) return <Spinner full />;

  const r = project.render;
  const done = r.status === 'done' && !!r.url;
  const cost = renderCost(projectDuration(project) || 15);
  const enough = (user?.credits ?? 0) >= cost;

  const copy = async () => {
    if (r.url && (await copyText(r.url))) flash(t('common.copied'));
  };
  const share = async () => {
    if (!r.url) return;
    if (navigator.share) {
      try {
        await navigator.share({ title: project.title, text: t('export.shareText'), url: r.url });
      } catch {
        /* user cancelled */
      }
    } else void copy();
  };
  const refreshLink = async () => {
    if (!r.jobId) return;
    setRefreshing(true);
    try {
      const link = await api.renderLink(r.jobId);
      onRender({ ...r, url: link.url, expiresAt: link.expiresAt });
      flash(t('export.linkRefreshed'));
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <Link to={`/editor/${project.id}`} className="btn-ghost btn-sm -ml-3">
        <ArrowLeft size={14} /> {t('export.backToEditor')}
      </Link>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="label-caps mb-2">{t('export.kicker')}</div>
          <h1 className="h-display text-3xl sm:text-4xl">{project.title}</h1>
        </div>
        <span className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wider ${done ? 'border-accent/60 text-accent-light' : 'border-line text-muted'}`}>
          {t(statusKey[r.status])}
          {r.status === 'rendering' ? ` · ${r.progress}%` : ''}
        </span>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="card flex items-center justify-center p-4 sm:p-6">
          <RenderPlayer
            render={r}
            format={r.format ?? project.format}
            className={(r.format ?? project.format) === '9:16' ? 'w-full max-w-[380px]' : 'w-full'}
          />
        </div>

        <div className="space-y-4">
          {user?.plan === 'free' && <WatermarkNotice />}

          <div className="card space-y-3 p-5">
            {r.status === 'idle' && <p className="text-sm text-muted">{t('export.noRender')}</p>}
            <a
              className={`btn-primary w-full ${done ? '' : 'pointer-events-none opacity-45'}`}
              href={r.url}
              download={`${project.title}.mp4`}
              target="_blank"
              rel="noreferrer"
              aria-disabled={!done}
            >
              <Download size={16} /> {t('output.download')}
            </a>
            <div className="grid grid-cols-2 gap-2">
              <button className="btn-secondary btn-sm" disabled={!done} onClick={() => void copy()}>
                <Copy size={14} /> {t('export.copyLink')}
              </button>
              <button className="btn-secondary btn-sm" disabled={!done} onClick={() => void share()}>
                <Share2 size={14} /> {t('export.share')}
              </button>
            </div>
            {note && <p className="text-center text-xs text-accent-light">{note}</p>}
            {done && r.expiresAt && (
              <div className="flex items-center gap-2 rounded-xl border border-line p-3 text-xs">
                <CalendarClock size={14} className="shrink-0 text-accent-light" />
                <span className="flex-1">{t('export.validUntil', { date: formatDate(r.expiresAt, true) })}</span>
                <button className="btn-ghost btn-sm px-2 py-1" disabled={refreshing} onClick={() => void refreshLink()}>
                  <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} /> {t('export.refreshLink')}
                </button>
              </div>
            )}
            <p className="text-[11px] text-muted">{t('export.storage')}</p>
          </div>

          <div className="card space-y-3 p-5">
            <div className="font-display font-bold">{t('export.rerenderTitle')}</div>
            <p className="text-xs text-muted">{t('export.rerenderText')}</p>
            <div className="grid grid-cols-3 gap-1 rounded-xl border border-line bg-bg p-1">
              {FORMATS.map((f) => (
                <button
                  key={f}
                  onClick={() => setFormat(f)}
                  className={`rounded-lg py-2 text-xs font-semibold transition ${format === f ? 'bg-accent/15 text-accent-light' : 'text-muted hover:text-white'}`}
                  title={t(formatKey[f])}
                >
                  {f}
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between text-xs text-muted">
              <span>{formatClock(projectDuration(project))}</span>
              <span className="inline-flex items-center gap-1">
                <Zap size={12} className="fill-accent text-accent" /> {t('export.cost', { n: cost })}
              </span>
            </div>
            <button className="btn-secondary w-full" disabled={starting || active || !enough} onClick={() => void start(format)}>
              <RotateCcw size={14} /> {t('export.rerender', { format })}
            </button>
            {(!enough || error === 'credits') && (
              <Link to="/account" className="block text-center text-xs text-accent-light hover:underline">
                {t('output.topUp')} →
              </Link>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
