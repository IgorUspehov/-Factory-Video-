import { useEffect, useRef, useState } from 'react';
import { Library, Pause, Play, Trash2, Upload, VolumeX } from 'lucide-react';
import { useEditor } from '../EditorContext';
import { useI18n } from '../../i18n';
import { api } from '../../lib/api';
import { AUDIO_EXT, MAX_AUDIO_BYTES, audioDuration, computePeaks } from '../../lib/media';
import { mockPeaks } from '../../lib/mock';
import { formatClock } from '../../lib/project';
import { MOODS, moodKey } from '../../lib/labels';
import { Waveform } from '../../components/Waveform';
import { Spinner } from '../../components/Spinner';
import { useAudioPreview } from '../../lib/useAudioPreview';
import type { LibraryTrack, Mood } from '../../types';

type Tab = 'upload' | 'library' | 'none';

export function AudioPanel() {
  const { project, update } = useEditor();
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>(project.audio?.source === 'library' ? 'library' : project.audio?.source === 'none' ? 'none' : 'upload');
  const [rights, setRights] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tracks, setTracks] = useState<LibraryTrack[] | null>(null);
  const [mood, setMood] = useState<Mood | ''>('');
  const inputRef = useRef<HTMLInputElement>(null);
  const preview = useAudioPreview();
  const a = project.audio;

  useEffect(() => {
    if (tab !== 'library') return;
    setTracks(null);
    api.libraryAudio(mood || undefined).then(setTracks).catch(() => setTracks([]));
  }, [tab, mood]);

  const onFile = async (file: File | undefined) => {
    setError(null);
    if (!file) return;
    if (!rights) return setError(t('audio.errors.rights'));
    if (!AUDIO_EXT.test(file.name)) return setError(t('audio.errors.type'));
    if (file.size > MAX_AUDIO_BYTES) return setError(t('audio.errors.size'));
    setBusy(true);
    try {
      const [uploaded, duration, peaks] = await Promise.all([api.uploadAudio(file, rights), audioDuration(file), computePeaks(file)]);
      const analysis = await api.analyzeAudio({ id: uploaded.id, url: uploaded.url, duration });
      update({
        audio: {
          source: 'upload',
          id: uploaded.id,
          name: file.name,
          url: uploaded.url,
          duration: analysis.duration || duration,
          bpm: analysis.bpm,
          beats: analysis.beats,
          peaks: peaks ?? analysis.peaks ?? mockPeaks(uploaded.id),
          rightsConfirmed: true,
        },
      });
    } catch {
      setError(t('audio.errors.upload'));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const pickTrack = async (track: LibraryTrack) => {
    setBusy(true);
    try {
      const analysis = await api.analyzeAudio({ id: track.id, url: track.url, duration: track.duration, bpm: track.bpm });
      update({
        audio: {
          source: 'library',
          id: track.id,
          name: `${track.title} — ${track.artist}`,
          url: track.url,
          duration: track.duration,
          bpm: analysis.bpm,
          beats: analysis.beats,
          peaks: analysis.peaks ?? mockPeaks(track.id),
        },
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      {a && a.source !== 'none' && (
        <div className="rounded-2xl border border-accent/40 bg-bg p-4">
          <div className="flex items-center gap-3">
            <button
              className="icon-tile h-10 w-10 rounded-full"
              onClick={() => a.url && preview.toggle('current', a.url)}
              aria-label={t(preview.playing === 'current' ? 'audio.pause' : 'audio.play')}
            >
              {preview.playing === 'current' ? <Pause size={16} /> : <Play size={16} />}
            </button>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{a.name}</div>
              <div className="text-xs text-muted">
                {formatClock(a.duration)}
                {a.bpm ? ` · ${a.bpm} BPM · ${t('audio.beats', { n: a.beats.length })}` : ''}
              </div>
            </div>
            <button className="btn-ghost p-2" onClick={() => update({ audio: null })} aria-label={t('common.remove')}>
              <Trash2 size={16} />
            </button>
          </div>
          <div className="mt-3">
            <Waveform peaks={a.peaks} beats={a.beats} duration={a.duration} progress={preview.playing === 'current' ? preview.progress : 0} height={56} />
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-1 rounded-xl border border-line bg-bg p-1">
        {(
          [
            ['upload', Upload, 'audio.tabs.upload'],
            ['library', Library, 'audio.tabs.library'],
            ['none', VolumeX, 'audio.tabs.none'],
          ] as const
        ).map(([id, Icon, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-semibold transition ${
              tab === id ? 'bg-accent/15 text-accent-light' : 'text-muted hover:text-white'
            }`}
          >
            <Icon size={14} /> {t(label)}
          </button>
        ))}
      </div>

      {tab === 'upload' && (
        <div className="space-y-3">
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line p-3 text-sm">
            <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#FF6A1A]" checked={rights} onChange={(e) => setRights(e.target.checked)} />
            <span>{t('audio.rights')}</span>
          </label>
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              void onFile(e.dataTransfer.files[0]);
            }}
            className={`flex flex-col items-center rounded-2xl border border-dashed p-6 text-center transition ${
              rights ? 'border-accent/60 bg-accent/[0.04]' : 'border-line opacity-60'
            }`}
          >
            {busy ? <Spinner /> : <Upload size={24} className="text-accent-light" />}
            <p className="mt-3 text-sm font-medium">{t('audio.drop')}</p>
            <p className="mt-1 text-xs text-muted">{t('audio.limits')}</p>
            <button className="btn-secondary btn-sm mt-4" disabled={!rights || busy} onClick={() => inputRef.current?.click()}>
              {t('audio.choose')}
            </button>
            <input
              ref={inputRef}
              type="file"
              accept=".mp3,.wav,.m4a,audio/mpeg,audio/wav,audio/mp4,audio/x-m4a"
              className="hidden"
              onChange={(e) => void onFile(e.target.files?.[0])}
            />
          </div>
        </div>
      )}

      {tab === 'library' && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            <button className={`chip ${mood === '' ? 'chip-active' : ''}`} onClick={() => setMood('')}>
              {t('common.all')}
            </button>
            {MOODS.map((m) => (
              <button key={m} className={`chip ${mood === m ? 'chip-active' : ''}`} onClick={() => setMood(m)}>
                {t(moodKey[m])}
              </button>
            ))}
          </div>
          {tracks === null ? (
            <div className="py-6 text-center">
              <Spinner />
            </div>
          ) : (
            <ul className="space-y-2">
              {tracks.map((tr) => (
                <li key={tr.id} className={`flex items-center gap-3 rounded-xl border p-2.5 ${a?.id === tr.id ? 'border-accent/60' : 'border-line'}`}>
                  <button
                    className="icon-tile h-9 w-9 rounded-full"
                    onClick={() => preview.toggle(tr.id, tr.url)}
                    aria-label={t(preview.playing === tr.id ? 'audio.pause' : 'audio.play')}
                  >
                    {preview.playing === tr.id ? <Pause size={14} /> : <Play size={14} />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{tr.title}</div>
                    <div className="text-[11px] text-muted">
                      {t(moodKey[tr.mood])} · {tr.bpm} BPM · {formatClock(tr.duration)}
                    </div>
                  </div>
                  <button className="btn-secondary btn-sm" disabled={busy || a?.id === tr.id} onClick={() => void pickTrack(tr)}>
                    {a?.id === tr.id ? t('common.selected') : t('common.use')}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === 'none' && (
        <div className="rounded-2xl border border-line p-4 text-sm">
          <p className="text-muted">{t('audio.noneText')}</p>
          <button
            className="btn-secondary btn-sm mt-4"
            disabled={a?.source === 'none'}
            onClick={() => update({ audio: { source: 'none', duration: 0, beats: [], peaks: [] } })}
          >
            <VolumeX size={14} /> {a?.source === 'none' ? t('audio.noneActive') : t('audio.noneCta')}
          </button>
        </div>
      )}

      {error && <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}
    </div>
  );
}
