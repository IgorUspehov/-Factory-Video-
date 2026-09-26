import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Clapperboard, Copy, Plus, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import { useI18n } from '../i18n';
import { formatClock, projectDuration } from '../lib/project';
import { goalKey, statusKey } from '../lib/labels';
import { Modal } from '../components/Modal';
import { Spinner } from '../components/Spinner';
import type { Project } from '../types';

function Preview({ p }: { p: Project }) {
  const thumbs = p.media.slice(0, 3);
  return (
    <div className="relative aspect-video overflow-hidden rounded-t-[18px]" style={{ background: p.style.background }}>
      {thumbs.length > 0 ? (
        <div className="grid h-full" style={{ gridTemplateColumns: `repeat(${thumbs.length}, 1fr)` }}>
          {thumbs.map((m) => (m.thumb ? <img key={m.id} src={m.thumb} alt="" className="h-full w-full object-cover" /> : <div key={m.id} />))}
        </div>
      ) : (
        <div className="flex h-full items-center justify-center">
          <Clapperboard size={32} style={{ color: p.style.accent }} />
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent" />
      <span className="absolute left-3 top-3 rounded-lg bg-black/70 px-2 py-1 text-[11px] font-bold">{p.format}</span>
      {projectDuration(p) > 0 && (
        <span className="absolute right-3 top-3 rounded-lg bg-black/70 px-2 py-1 text-[11px] tabular-nums">{formatClock(projectDuration(p))}</span>
      )}
    </div>
  );
}

export default function Projects() {
  const { t, formatDate } = useI18n();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [toDelete, setToDelete] = useState<Project | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = () => api.listProjects().then(setProjects).catch(() => setProjects([]));
  useEffect(() => {
    void load();
  }, []);

  const duplicate = async (p: Project) => {
    setBusy(p.id);
    try {
      const { id, createdAt, updatedAt, ...draft } = p;
      await api.createProject({ ...draft, title: t('projects.copyOf', { title: p.title }), render: { status: 'idle', progress: 0 } });
      await load();
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    if (!toDelete) return;
    setBusy(toDelete.id);
    try {
      await api.deleteProject(toDelete.id);
      setProjects((list) => list?.filter((x) => x.id !== toDelete.id) ?? null);
    } finally {
      setBusy(null);
      setToDelete(null);
    }
  };

  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="label-caps mb-3">{t('projects.kicker')}</div>
          <h1 className="h-display text-3xl sm:text-4xl">
            {t('projects.title1')} <span className="text-gradient">{t('projects.title2')}</span>
          </h1>
        </div>
        <Link to="/start" className="btn-primary">
          <Plus size={16} /> {t('projects.create')} →
        </Link>
      </div>

      {projects === null ? (
        <Spinner full />
      ) : projects.length === 0 ? (
        <div className="card mt-10 flex flex-col items-center p-12 text-center">
          <span className="icon-tile h-14 w-14 rounded-2xl">
            <Clapperboard size={24} />
          </span>
          <h2 className="mt-5 font-display text-xl font-bold">{t('projects.emptyTitle')}</h2>
          <p className="mt-2 max-w-sm text-sm text-muted">{t('projects.emptyText')}</p>
          <div className="hand mt-4 text-2xl">{t('projects.emptyHand')}</div>
          <Link to="/start" className="btn-primary mt-6">
            {t('projects.create')} →
          </Link>
        </div>
      ) : (
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <article key={p.id} className="card group flex flex-col overflow-hidden transition hover:border-accent/60 hover:shadow-glow-sm">
              <button className="text-left" onClick={() => navigate(`/editor/${p.id}`)} aria-label={p.title}>
                <Preview p={p} />
              </button>
              <div className="flex flex-1 flex-col p-5">
                <button className="truncate text-left font-display text-lg font-bold hover:text-accent-light" onClick={() => navigate(`/editor/${p.id}`)}>
                  {p.title || t('projects.untitled')}
                </button>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                  <span>{t(goalKey[p.goal])}</span>
                  <span>·</span>
                  <span>{formatDate(p.updatedAt, true)}</span>
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <span
                    className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
                      p.render.status === 'done' ? 'border-accent/60 text-accent-light' : 'border-line text-muted'
                    }`}
                  >
                    {p.render.status === 'idle' ? t('projects.draft') : t(statusKey[p.render.status])}
                  </span>
                  <div className="flex gap-1">
                    <button className="btn-ghost p-2" disabled={busy === p.id} onClick={() => void duplicate(p)} title={t('projects.duplicate')} aria-label={t('projects.duplicate')}>
                      <Copy size={16} />
                    </button>
                    <button className="btn-ghost p-2 hover:text-red-300" disabled={busy === p.id} onClick={() => setToDelete(p)} title={t('projects.delete')} aria-label={t('projects.delete')}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <Modal open={!!toDelete} onClose={() => setToDelete(null)} title={t('projects.deleteTitle')}>
        <p className="text-sm text-muted">{t('projects.deleteText', { title: toDelete?.title ?? '' })}</p>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button className="btn-secondary" onClick={() => setToDelete(null)}>
            {t('common.cancel')}
          </button>
          <button className="btn-primary" disabled={!!busy} onClick={() => void remove()}>
            <Trash2 size={16} /> {t('projects.delete')}
          </button>
        </div>
      </Modal>
    </section>
  );
}
