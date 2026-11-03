import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Download, Link2, Loader2, Mic, RefreshCw, Sparkles, Upload } from 'lucide-react';
import { useEditor } from '../EditorContext';
import { useI18n, type TKey } from '../../i18n';
import { api, ApiError } from '../../lib/api';
import { copyText } from '../../lib/share';
import { Hint } from '../../components/Hint';
import type { AvatarDraft, AvatarJob, AvatarLang, AvatarProfile } from '../../types';

const LANGS: AvatarLang[] = ['ru', 'en', 'de'];
const ERROR_CODES = new Set([
  'photo_not_portrait',
  'photo_too_small',
  'unsupported_type',
  'invalid_file',
  'file_too_large',
  'voice_duration',
  'empty_text',
  'text_too_long',
  'invalid_languages',
  'profile_incomplete',
  'daily_limit',
  'avatar_not_configured',
  'forbidden',
]);
const isActive = (j: AvatarJob) => j.status === 'queued' || j.status === 'running';
const POLL_MS = 4000;

export function AvatarPanel() {
  const { project, update } = useEditor();
  const { t, formatDate } = useI18n();
  const draft: AvatarDraft = project.avatar ?? { text: '', languages: ['ru'] };

  const [profile, setProfile] = useState<AvatarProfile | null>(null);
  const [busy, setBusy] = useState<'photo' | 'voice' | 'create' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [jobs, setJobs] = useState<AvatarJob[]>([]);
  const [copied, setCopied] = useState<string | null>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const voiceInput = useRef<HTMLInputElement>(null);
  const results = useRef<HTMLElement>(null);

  const errorText = useCallback(
    (err: unknown): string => {
      const code = err instanceof ApiError ? err.message : '';
      if (!ERROR_CODES.has(code)) return t('avatar.errors.generic');
      const [min, max] = profile?.limits.voiceSeconds ?? [3, 12];
      return t(`avatar.errors.${code}` as TKey, { min, max });
    },
    [t, profile],
  );

  useEffect(() => {
    api
      .avatarProfile()
      .then(setProfile)
      .catch((e) => setError(errorText(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // the photo is private: fetched with the token, shown through an object URL
  const photoStamp = profile?.photo?.updatedAt;
  useEffect(() => {
    if (!photoStamp) {
      setPhotoUrl(null);
      return;
    }
    let url: string | null = null;
    let cancelled = false;
    api
      .avatarPhotoBlob()
      .then((b) => {
        if (cancelled) return;
        url = URL.createObjectURL(b);
        setPhotoUrl(url);
      })
      .catch(() => setPhotoUrl(null));
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [photoStamp]);

  const loadJobs = useCallback(() => api.avatarJobs(project.id).then(setJobs).catch(() => undefined), [project.id]);
  useEffect(() => {
    void loadJobs();
  }, [loadJobs]);
  const anyActive = jobs.some(isActive);
  useEffect(() => {
    if (!anyActive) return;
    const id = window.setInterval(() => void loadJobs(), POLL_MS);
    return () => window.clearInterval(id);
  }, [anyActive, loadJobs]);

  const upload = (kind: 'photo' | 'voice') => async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(kind);
    setError(null);
    try {
      setProfile(await (kind === 'photo' ? api.avatarUploadPhoto(file) : api.avatarUploadVoice(file)));
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(null);
    }
  };

  const setText = (text: string) => update({ avatar: { ...draft, text } });
  const toggleLang = (l: AvatarLang) => {
    const has = draft.languages.includes(l);
    update({ avatar: { ...draft, languages: LANGS.filter((x) => (x === l ? !has : draft.languages.includes(x))) } });
  };

  const maxChars = profile?.limits.textChars ?? 1200;
  const text = draft.text.trim();
  const canCreate = !!profile?.ready && profile.configured && text.length > 0 && draft.languages.length > 0 && busy === null;

  const create = async () => {
    setBusy('create');
    setError(null);
    try {
      const res = await api.avatarCreateJobs({ projectId: project.id, text, languages: draft.languages });
      setJobs((prev) => [...res.jobs, ...prev]);
      // the list sits below the form: bring the progress into view
      window.setTimeout(() => results.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(null);
    }
  };

  const retry = async (id: string) => {
    try {
      const j = await api.avatarRetry(id);
      setJobs((prev) => prev.map((x) => (x.id === id ? j : x)));
    } catch (err) {
      setError(errorText(err));
    }
  };

  const copyLink = async (job: AvatarJob) => {
    try {
      const link = await api.avatarLink(job.id);
      if (await copyText(link.url)) {
        setCopied(job.id);
        window.setTimeout(() => setCopied((c) => (c === job.id ? null : c)), 2500);
      }
    } catch (err) {
      setError(errorText(err));
    }
  };

  const fileButton = (kind: 'photo' | 'voice', has: boolean) => (
    <button className="btn-secondary btn-sm" disabled={busy !== null} onClick={() => (kind === 'photo' ? photoInput : voiceInput).current?.click()}>
      {busy === kind ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
      {busy === kind ? t('avatar.profile.uploading') : has ? t('avatar.profile.replace') : t('avatar.profile.upload')}
    </button>
  );

  const nCreate = draft.languages.length;
  const [vMin, vMax] = profile?.limits.voiceSeconds ?? [3, 12];

  return (
    <div className="space-y-6">
      <Hint>{t('avatar.intro')}</Hint>

      {/* photo + voice, set once */}
      <section className="space-y-3">
        <div className="label-caps">{t('avatar.profile.title')}</div>
        <div className="card flex items-start gap-4 p-4">
          <div className="h-28 w-[74px] shrink-0 overflow-hidden rounded-xl border border-line bg-bg">
            {photoUrl && <img src={photoUrl} alt={t('avatar.profile.photoAlt')} className="h-full w-full object-cover" />}
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <div className="text-sm font-semibold">{t('avatar.profile.photo')}</div>
            <p className="text-xs text-muted">{profile?.hasPhoto ? `${profile.photo?.width}×${profile.photo?.height}` : t('avatar.profile.missing')}</p>
            <p className="text-xs text-muted">{t('avatar.profile.photoHint')}</p>
            {fileButton('photo', !!profile?.hasPhoto)}
            <input ref={photoInput} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={upload('photo')} />
          </div>
        </div>
        <div className="card flex items-start gap-4 p-4">
          <span className="icon-tile h-12 w-12 shrink-0">
            <Mic size={20} />
          </span>
          <div className="min-w-0 flex-1 space-y-2">
            <div className="text-sm font-semibold">{t('avatar.profile.voice')}</div>
            <p className="text-xs text-muted">{profile?.hasVoice ? t('avatar.profile.voiceSet', { n: profile.voice?.duration ?? 0 }) : t('avatar.profile.missing')}</p>
            <p className="text-xs text-muted">{t('avatar.profile.voiceHint', { min: vMin, max: vMax })}</p>
            {fileButton('voice', !!profile?.hasVoice)}
            <input ref={voiceInput} type="file" accept="audio/*,.wav,.mp3,.m4a,.ogg" className="hidden" onChange={upload('voice')} />
          </div>
        </div>
        <p className="text-xs text-muted">{t('avatar.profile.privacy')}</p>
      </section>

      {/* text + languages */}
      <section className="space-y-3">
        <div className="label-caps">{t('avatar.text.title')}</div>
        <textarea
          className="input min-h-[140px] w-full resize-y"
          value={draft.text}
          maxLength={maxChars}
          placeholder={t('avatar.text.placeholder')}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="text-right text-xs text-muted">{t('avatar.text.counter', { n: draft.text.length, max: maxChars })}</div>

        <div className="label-caps">{t('avatar.languages.title')}</div>
        <div className="flex flex-wrap gap-2">
          {LANGS.map((l) => (
            <button
              key={l}
              onClick={() => toggleLang(l)}
              aria-pressed={draft.languages.includes(l)}
              className={`chip min-h-[44px] px-4 ${draft.languages.includes(l) ? 'chip-active' : ''}`}
            >
              {t(`avatar.languages.${l}`)}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted">{t('avatar.languages.hint')}</p>
      </section>

      <section className="space-y-3">
        <button className="btn-primary w-full py-3.5 text-base" disabled={!canCreate} onClick={() => void create()}>
          {busy === 'create' ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
          {busy === 'create' ? t('avatar.creating') : nCreate > 1 ? t('avatar.createMany', { n: nCreate }) : t('avatar.createOne')}
        </button>
        <p className="text-xs text-muted">{t('avatar.cost')}</p>
        {profile && !profile.configured && <p className="text-sm text-red-300">{t('avatar.errors.avatar_not_configured')}</p>}
        {error && <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}
      </section>

      {/* results */}
      <section ref={results} className="scroll-mt-4 space-y-3">
        <div className="label-caps">{t('avatar.jobs.title')}</div>
        {jobs.length === 0 && <p className="text-sm text-muted">{t('avatar.jobs.empty')}</p>}
        {jobs.map((j) => (
          <div key={j.id} className="card space-y-3 p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="rounded-md bg-accent/15 px-2 py-0.5 text-xs font-bold uppercase text-accent-light">{j.language}</span>
              <span className={`text-sm ${j.status === 'failed' ? 'text-red-300' : j.status === 'done' ? 'text-accent-light' : 'text-white'}`}>
                {j.status === 'failed'
                  ? t('avatar.jobs.failed')
                  : j.status === 'queued'
                    ? t('avatar.jobs.queued')
                    : j.stage
                      ? t(`avatar.jobs.stage.${j.stage}`)
                      : t('avatar.jobs.queued')}
              </span>
            </div>
            {isActive(j) && (
              <div className="h-1.5 overflow-hidden rounded-full bg-bg" role="progressbar" aria-valuenow={j.progress} aria-valuemin={0} aria-valuemax={100}>
                <div className="glow-line h-full transition-all" style={{ width: `${j.progress}%` }} />
              </div>
            )}
            {j.status === 'failed' && (
              <div className="space-y-2">
                {j.error && <p className="break-words text-xs text-muted">{j.error.slice(0, 160)}</p>}
                <button className="btn-secondary btn-sm" onClick={() => void retry(j.id)}>
                  <RefreshCw size={14} /> {t('avatar.jobs.retry')}
                </button>
              </div>
            )}
            {j.status === 'done' && j.url && (
              <div className="space-y-3">
                <video src={j.url} controls playsInline preload="metadata" className="aspect-[9/16] w-full max-w-[220px] rounded-xl bg-bg" />
                <div className="flex flex-wrap gap-2">
                  <a className="btn-primary btn-sm" href={`${j.url}&download=1`} target="_blank" rel="noreferrer">
                    <Download size={14} /> {t('avatar.jobs.download')}
                  </a>
                  <button className="btn-secondary btn-sm" onClick={() => void copyLink(j)}>
                    <Link2 size={14} /> {copied === j.id ? t('common.copied') : t('avatar.jobs.copyLink')}
                  </button>
                </div>
                {j.expiresAt && <p className="text-[11px] text-muted">{t('avatar.jobs.validUntil', { date: formatDate(j.expiresAt, true) })}</p>}
              </div>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}
