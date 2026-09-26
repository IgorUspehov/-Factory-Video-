import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, ExternalLink, Link2, X } from 'lucide-react';
import { useEditor } from './EditorContext';
import { useI18n } from '../i18n';
import { api } from '../lib/api';
import { copyText } from '../lib/share';
import { Modal } from '../components/Modal';
import { RenderPlayer } from '../components/RenderPlayer';

/** Large player over the canvas; opens by itself when a render started in this session is done. */
export function PlayerModal() {
  const { project, update, playerOpen, setPlayerOpen } = useEditor();
  const { t, formatDate } = useI18n();
  const [copied, setCopied] = useState(false);
  const r = project.render;
  const format = r.format ?? project.format;
  if (!playerOpen || r.status !== 'done' || !r.url) return null;

  const copyLink = async () => {
    let url = r.url!;
    if (r.jobId) {
      try {
        const link = await api.renderLink(r.jobId);
        update({ render: { ...r, url: link.url, expiresAt: link.expiresAt } });
        url = link.url;
      } catch {
        /* keep the current link */
      }
    }
    setCopied(await copyText(url));
    window.setTimeout(() => setCopied(false), 2500);
  };

  return (
    <Modal open onClose={() => setPlayerOpen(false)} title={t('player.title')} size="lg">
      <RenderPlayer render={r} format={format} className={format === '9:16' ? 'max-h-[62dvh] max-w-[min(100%,360px)]' : 'max-h-[62dvh] w-full'} />
      {r.expiresAt && <p className="mt-3 text-center text-[13px] text-muted">{t('export.validUntil', { date: formatDate(r.expiresAt, true) })}</p>}
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <a className="btn-primary" href={r.url} download={`${project.title}.mp4`} target="_blank" rel="noreferrer" title={t('player.downloadHint')}>
          <Download size={16} /> {t('output.download')}
        </a>
        <button className="btn-secondary" onClick={() => void copyLink()} title={t('player.copyHint')}>
          <Link2 size={16} /> {copied ? t('common.copied') : t('export.copyLink')}
        </button>
        <Link className="btn-secondary" to={`/export/${project.id}`} title={t('player.exportHint')}>
          <ExternalLink size={16} /> {t('output.openExport')}
        </Link>
        <button className="btn-ghost" onClick={() => setPlayerOpen(false)}>
          <X size={16} /> {t('common.close')}
        </button>
      </div>
    </Modal>
  );
}
