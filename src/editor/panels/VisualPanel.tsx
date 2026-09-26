import { useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Film, GripVertical, Library, Trash2, Upload } from 'lucide-react';
import { useEditor } from '../EditorContext';
import { useI18n } from '../../i18n';
import { api } from '../../lib/api';
import { imageThumb, videoInfo } from '../../lib/media';
import { syncTimeline } from '../../lib/project';
import { uploadsStore } from '../../lib/uploads';
import { Modal } from '../../components/Modal';
import { Spinner } from '../../components/Spinner';
import { MediaBrowser } from '../../components/MediaBrowser';
import { Hint } from '../../components/Hint';
import type { MediaItem, Project } from '../../types';

const MAX_MEDIA_BYTES = 200 * 1024 * 1024;

function reorder(project: Project, media: MediaItem[]): Partial<Project> {
  const synced = syncTimeline(media, project.timeline);
  const index = new Map(media.map((m, i) => [m.id, i]));
  return { media, timeline: [...synced].sort((a, b) => (index.get(a.mediaId) ?? 0) - (index.get(b.mediaId) ?? 0)) };
}

export function VisualPanel() {
  const { project, update } = useEditor();
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [picker, setPicker] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const dragIndex = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const add = (items: MediaItem[]) => update((p) => reorder(p, [...p.media, ...items]));

  const onFiles = async (files: FileList | File[] | null) => {
    if (!files) return;
    setError(null);
    const list = Array.from(files).filter((f) => f.type.startsWith('image/') || f.type.startsWith('video/'));
    if (list.length === 0) return setError(t('visual.errors.type'));
    setBusy(true);
    const added: MediaItem[] = [];
    for (const file of list) {
      if (file.size > MAX_MEDIA_BYTES) {
        setError(t('visual.errors.size'));
        continue;
      }
      try {
        const isVideo = file.type.startsWith('video/');
        const [uploaded, info] = await Promise.all([
          api.uploadMedia(file),
          isVideo ? videoInfo(file) : imageThumb(file).then((thumb) => ({ thumb, duration: undefined })),
        ]);
        added.push({ id: uploaded.id, kind: isVideo ? 'video' : 'image', url: uploaded.url, thumb: info.thumb, name: file.name, duration: info.duration, source: 'upload' });
      } catch {
        setError(t('visual.errors.upload'));
      }
    }
    if (added.length) {
      add(added);
      uploadsStore.add(added);
    }
    setBusy(false);
    if (inputRef.current) inputRef.current.value = '';
  };

  const move = (from: number, to: number) => {
    if (to < 0 || to >= project.media.length || from === to) return;
    const media = [...project.media];
    const [item] = media.splice(from, 1);
    media.splice(to, 0, item);
    update((p) => reorder(p, media));
  };

  const remove = (id: string) => update((p) => reorder(p, p.media.filter((m) => m.id !== id)));

  return (
    <div className="space-y-4">
      <Hint>{t('visual.intro')}</Hint>
      <div
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes('Files')) {
            e.preventDefault();
            setDragOver(true);
          }
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          void onFiles(e.dataTransfer.files);
        }}
        className={`flex flex-col items-center rounded-2xl border border-dashed p-6 text-center transition ${
          dragOver ? 'border-accent bg-accent/10 shadow-glow-sm' : 'border-accent/50 bg-accent/[0.04]'
        }`}
      >
        {busy ? <Spinner /> : <Upload size={24} className="text-accent-light" />}
        <p className="mt-3 text-sm font-medium">{t('visual.drop')}</p>
        <p className="mt-1 text-xs text-muted">{t('visual.limits')}</p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <button className="btn-secondary btn-sm" disabled={busy} onClick={() => inputRef.current?.click()} title={t('visual.chooseHint')}>
            <Upload size={14} /> {t('visual.choose')}
          </button>
          <button className="btn-primary btn-sm" onClick={() => setPicker(true)} title={t('visual.libraryHint')}>
            <Library size={14} /> {t('visual.library')}
          </button>
        </div>
        <input ref={inputRef} type="file" multiple accept="image/*,video/*" className="hidden" onChange={(e) => void onFiles(e.target.files)} />
      </div>

      {error && <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}

      {project.media.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <span className="label-caps">{t('nodes.items', { n: project.media.length })}</span>
            <span className="text-[11px] text-muted">{t('visual.sortHint')}</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {project.media.map((m, i) => (
              <div
                key={m.id}
                draggable
                onDragStart={() => (dragIndex.current = i)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragIndex.current !== null) move(dragIndex.current, i);
                  dragIndex.current = null;
                }}
                className="group relative aspect-square cursor-grab overflow-hidden rounded-xl border border-line bg-bg active:cursor-grabbing"
              >
                {m.thumb ? (
                  <img src={m.thumb} alt={m.name} className="h-full w-full object-cover" draggable={false} />
                ) : (
                  <div className="flex h-full items-center justify-center text-muted">
                    <Film size={20} />
                  </div>
                )}
                <span className="absolute left-1.5 top-1.5 rounded-md bg-black/70 px-1.5 text-[10px] font-bold tabular-nums">{i + 1}</span>
                {m.kind === 'video' && <Film size={13} className="absolute right-1.5 top-1.5 text-white drop-shadow" />}
                <GripVertical size={14} className="absolute left-1/2 top-1.5 hidden -translate-x-1/2 text-white/70 group-hover:block" />
                <div className="absolute inset-x-0 bottom-0 flex justify-between bg-gradient-to-t from-black/80 p-1">
                  <button className="rounded p-1 hover:bg-white/10" onClick={() => move(i, i - 1)} aria-label={t('common.moveLeft')}>
                    <ArrowLeft size={12} />
                  </button>
                  <button className="rounded p-1 hover:bg-white/10" onClick={() => remove(m.id)} aria-label={t('common.remove')}>
                    <Trash2 size={12} />
                  </button>
                  <button className="rounded p-1 hover:bg-white/10" onClick={() => move(i, i + 1)} aria-label={t('common.moveRight')}>
                    <ArrowRight size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <Modal open={picker} onClose={() => setPicker(false)} title={t('visual.libraryTitle')} size="lg">
        <MediaBrowser
          mode="pick"
          format={project.format}
          initialNiche={project.goal === 'clip' ? 'music' : undefined}
          onAdd={(items) => {
            add(items);
            setPicker(false);
          }}
        />
      </Modal>
    </div>
  );
}
