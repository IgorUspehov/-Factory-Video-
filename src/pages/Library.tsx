import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Film, FolderUp, Image as ImageIcon, Music, Pause, Play, Trash2, type LucideIcon } from 'lucide-react';
import { api } from '../lib/api';
import { useI18n, type TKey } from '../i18n';
import { useAudioPreview } from '../lib/useAudioPreview';
import { uploadsStore } from '../lib/uploads';
import { mockPeaks } from '../lib/mock';
import { formatClock } from '../lib/project';
import { MOODS, NICHES, moodKey, nicheKey } from '../lib/labels';
import { Waveform } from '../components/Waveform';
import { Modal } from '../components/Modal';
import { Spinner } from '../components/Spinner';
import { MediaBrowser } from '../components/MediaBrowser';
import type { LibraryTrack, MediaItem, Mood, Niche } from '../types';

type Tab = 'audio' | 'video' | 'photo' | 'uploads';
const TABS: { id: Tab; icon: LucideIcon; label: TKey }[] = [
  { id: 'audio', icon: Music, label: 'library.tabs.audio' },
  { id: 'video', icon: Film, label: 'library.tabs.video' },
  { id: 'photo', icon: ImageIcon, label: 'library.tabs.photo' },
  { id: 'uploads', icon: FolderUp, label: 'library.tabs.uploads' },
];

export default function Library() {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>('audio');
  const [mood, setMood] = useState<Mood | ''>('');
  const [niche, setNiche] = useState<Niche | ''>('');
  const [tracks, setTracks] = useState<LibraryTrack[] | null>(null);
  const [uploads, setUploads] = useState<MediaItem[]>(uploadsStore.list);
  const [open, setOpen] = useState<{ kind: 'image' | 'video'; url: string; title: string } | null>(null);
  const preview = useAudioPreview();

  useEffect(() => {
    if (tab === 'audio') {
      setTracks(null);
      api.libraryAudio(mood || undefined, niche || undefined).then(setTracks).catch(() => setTracks([]));
    } else if (tab === 'uploads') {
      setUploads(uploadsStore.list());
    }
  }, [tab, mood, niche]);

  const Chips = () => (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="label-caps mr-2 w-24">{t('library.mood')}</span>
        <button className={`chip ${mood === '' ? 'chip-active' : ''}`} onClick={() => setMood('')}>
          {t('common.all')}
        </button>
        {MOODS.map((m) => (
          <button key={m} className={`chip ${mood === m ? 'chip-active' : ''}`} onClick={() => setMood(m)}>
            {t(moodKey[m])}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="label-caps mr-2 w-24">{t('library.niche')}</span>
        <button className={`chip ${niche === '' ? 'chip-active' : ''}`} onClick={() => setNiche('')}>
          {t('common.all')}
        </button>
        {NICHES.map((n) => (
          <button key={n} className={`chip ${niche === n ? 'chip-active' : ''}`} onClick={() => setNiche(n)}>
            {t(nicheKey[n])}
          </button>
        ))}
      </div>
    </div>
  );

  const empty = <p className="py-12 text-center text-sm text-muted">{t('common.nothingFound')}</p>;

  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="label-caps mb-3">{t('library.kicker')}</div>
      <h1 className="h-display text-3xl sm:text-4xl">
        {t('library.title1')} <span className="text-gradient">{t('library.title2')}</span>
      </h1>
      <p className="mt-2 max-w-2xl text-muted">{t('library.subtitle')}</p>

      <div className="scrollbar-thin mt-8 flex gap-1 overflow-x-auto rounded-2xl border border-line bg-card p-1 sm:inline-flex">
        {TABS.map((tb) => (
          <button
            key={tb.id}
            onClick={() => setTab(tb.id)}
            className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
              tab === tb.id ? 'bg-accent/15 text-accent-light shadow-glow-sm' : 'text-muted hover:text-white'
            }`}
          >
            <tb.icon size={16} /> {t(tb.label)}
          </button>
        ))}
      </div>

      {tab === 'audio' && (
        <div className="mt-6">
          <Chips />
        </div>
      )}

      <div className="mt-8">
        {tab === 'audio' &&
          (tracks === null ? (
            <Spinner full />
          ) : tracks.length === 0 ? (
            empty
          ) : (
            <ul className="space-y-2">
              {tracks.map((tr) => (
                <li key={tr.id} className={`card flex items-center gap-4 p-3 sm:p-4 ${preview.playing === tr.id ? 'border-accent/60' : ''}`}>
                  <button
                    className="icon-tile h-11 w-11 rounded-full"
                    onClick={() => preview.toggle(tr.id, tr.url)}
                    aria-label={t(preview.playing === tr.id ? 'audio.pause' : 'audio.play')}
                  >
                    {preview.playing === tr.id ? <Pause size={18} /> : <Play size={18} />}
                  </button>
                  <div className="w-32 min-w-0 shrink-0 sm:w-48">
                    <div className="truncate font-semibold">{tr.title}</div>
                    <div className="truncate text-xs text-muted">{tr.artist}</div>
                  </div>
                  <div className="hidden flex-1 md:block">
                    <Waveform peaks={mockPeaks(tr.id, 90)} height={32} progress={preview.playing === tr.id ? preview.progress : 0} />
                  </div>
                  <div className="ml-auto flex shrink-0 flex-col items-end gap-1 text-xs text-muted sm:flex-row sm:items-center sm:gap-3">
                    <span className="chip px-2 py-0.5">{t(moodKey[tr.mood])}</span>
                    <span className="hidden sm:inline">{t(nicheKey[tr.niche])}</span>
                    <span className="tabular-nums">{tr.bpm} BPM</span>
                    <span className="tabular-nums">{formatClock(tr.duration)}</span>
                  </div>
                </li>
              ))}
            </ul>
          ))}

        {(tab === 'video' || tab === 'photo') && (
          <MediaBrowser
            key={tab}
            mode="browse"
            fixedKind={tab === 'video' ? 'video' : 'image'}
            onOpen={(m) => setOpen({ kind: m.kind, url: m.url, title: m.title })}
          />
        )}

        {tab === 'uploads' &&
          (uploads.length === 0 ? (
            <div className="card flex flex-col items-center p-12 text-center">
              <span className="icon-tile h-14 w-14 rounded-2xl">
                <FolderUp size={24} />
              </span>
              <p className="mt-4 max-w-sm text-sm text-muted">{t('library.uploadsEmpty')}</p>
              <Link to="/projects" className="btn-secondary mt-6">
                {t('nav.myProjects')} →
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {uploads.map((u) => (
                <div key={u.id} className="card group relative aspect-square overflow-hidden">
                  {u.thumb ? (
                    <img src={u.thumb} alt={u.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-muted">
                      <Film size={24} />
                    </div>
                  )}
                  <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-gradient-to-t from-black/90 p-2">
                    <span className="min-w-0 flex-1 truncate text-xs">{u.name}</span>
                    <button
                      className="rounded-lg p-1.5 hover:bg-white/10"
                      onClick={() => {
                        uploadsStore.remove(u.id);
                        setUploads(uploadsStore.list());
                      }}
                      aria-label={t('common.remove')}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ))}
      </div>

      <Modal open={!!open} onClose={() => setOpen(null)} title={open?.title ?? ''}>
        {open?.kind === 'video' ? (
          <video src={open.url} controls autoPlay playsInline className="w-full rounded-xl" />
        ) : open ? (
          <img src={open.url} alt={open.title} className="w-full rounded-xl" />
        ) : null}
      </Modal>
    </section>
  );
}
