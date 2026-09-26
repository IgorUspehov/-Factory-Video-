import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Camera, Check, Film, Image as ImageIcon, Play, Search, X } from 'lucide-react';
import { api } from '../lib/api';
import { useI18n, type TKey } from '../i18n';
import { MOODS, NICHES, moodKey, nicheKey } from '../lib/labels';
import { uid } from '../lib/project';
import { Spinner } from './Spinner';
import type { Format, LibraryMedia, MediaItem, Mood, Niche } from '../types';

type Kind = 'all' | 'image' | 'video';
const ORIENTATION: Record<Format, string> = { '9:16': 'portrait', '16:9': 'landscape', '1:1': 'square' };
const ORIENTATION_LABEL: Record<Format, TKey> = { '9:16': 'media.orientation.portrait', '16:9': 'media.orientation.landscape', '1:1': 'media.orientation.square' };

export const toMediaItem = (i: LibraryMedia): MediaItem => ({
  id: uid('med'),
  kind: i.kind,
  url: i.url,
  thumb: i.thumb,
  name: i.title,
  duration: i.duration,
  source: 'library',
  credit: i.credit,
});

interface Props {
  mode: 'pick' | 'browse';
  format?: Format;
  initialNiche?: Niche;
  onAdd?: (items: MediaItem[]) => void;
  onOpen?: (item: LibraryMedia) => void;
  /** fixed kind (Library page tabs) — hides the photo/video filter */
  fixedKind?: 'image' | 'video';
}

/**
 * Search + infinite list of library media (Pexels or static list).
 * Every new search gets a generation number; responses of older generations are dropped, so the grid can
 * never be replaced by a stale response while the user is picking. The selection stores the clicked items
 * themselves (not indices or ids to look up later), so exactly those are added.
 */
export function MediaBrowser({ mode, format, initialNiche, onAdd, onOpen, fixedKind }: Props) {
  const { t, lang } = useI18n();
  const [input, setInput] = useState('');
  const [q, setQ] = useState('');
  const [mood, setMood] = useState<Mood | ''>('');
  const [niche, setNiche] = useState<Niche | ''>(initialNiche ?? '');
  const [kindState, setKind] = useState<Kind>('all');
  const kind: Kind = fixedKind ?? kindState;
  const [fitFormat, setFitFormat] = useState(true);
  const [items, setItems] = useState<LibraryMedia[]>([]);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [failed, setFailed] = useState(false);
  const [selected, setSelected] = useState<LibraryMedia[]>([]);
  const generation = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const orientation = format && fitFormat ? ORIENTATION[format] : undefined;

  const load = useCallback(
    async (nextPage: number, gen: number) => {
      setLoading(true);
      try {
        const res = await api.libraryMedia({
          q: q || undefined,
          mood: q ? undefined : mood || undefined,
          niche: q ? undefined : niche || undefined,
          kind: kind === 'all' ? undefined : kind,
          orientation,
          page: nextPage,
          lang,
        });
        if (gen !== generation.current) return; // stale response of an older search
        setItems((prev) => {
          const seen = new Set(prev.map((i) => i.id));
          return nextPage === 1 ? res : [...prev, ...res.filter((i) => !seen.has(i.id))];
        });
        setPage(nextPage);
        setDone(res.length === 0);
        setFailed(false);
      } catch {
        if (gen === generation.current) setFailed(true);
      } finally {
        if (gen === generation.current) setLoading(false);
      }
    },
    [q, mood, niche, kind, orientation, lang],
  );

  // new search → reset list, bump generation
  useEffect(() => {
    const gen = ++generation.current;
    setItems([]);
    setPage(0);
    setDone(false);
    void load(1, gen);
  }, [load]);

  // infinite scroll
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !loading && !done && page > 0) void load(page + 1, generation.current);
      },
      { root: mode === 'pick' ? scrollRef.current : null, rootMargin: '300px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [load, loading, done, page, mode]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setQ(input.trim());
  };

  const toggle = (item: LibraryMedia) =>
    setSelected((sel) => (sel.some((s) => s.id === item.id) ? sel.filter((s) => s.id !== item.id) : [...sel, item]));

  const chip = (active: boolean, label: string, onClick: () => void, key: string) => (
    <button key={key} type="button" className={`chip ${active ? 'chip-active' : ''}`} onClick={onClick}>
      {label}
    </button>
  );

  return (
    <div className="space-y-3">
      <form onSubmit={submit} className="flex gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            className="input pl-10"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t('media.searchPlaceholder')}
            aria-label={t('media.search')}
            enterKeyHint="search"
          />
        </div>
        <button className="btn-primary px-4" title={t('media.search')}>
          <Search size={16} />
          <span className="hidden sm:inline">{t('media.search')}</span>
        </button>
      </form>

      <div className="flex flex-wrap items-center gap-1.5">
        {!fixedKind && (
          [
            ['all', null, 'media.kind.all'],
            ['image', ImageIcon, 'media.kind.image'],
            ['video', Film, 'media.kind.video'],
          ] as const
        ).map(([k, Icon, label]) => (
          <button key={k} type="button" className={`chip ${kind === k ? 'chip-active' : ''}`} onClick={() => setKind(k)}>
            {Icon && <Icon size={13} />} {t(label)}
          </button>
        ))}
        {format && (
          <label className="ml-auto flex cursor-pointer items-center gap-2 text-[13px] text-muted" title={t('media.orientation.hint')}>
            <input type="checkbox" className="h-4 w-4 accent-[#FF6A1A]" checked={fitFormat} onChange={(e) => setFitFormat(e.target.checked)} />
            {t(ORIENTATION_LABEL[format])}
          </label>
        )}
      </div>

      <div>
        <div className="label-caps mb-1.5">{t('media.suggestions')}</div>
        <div className="flex flex-wrap gap-1.5">
          {NICHES.map((n) =>
            chip(!q && niche === n, t(nicheKey[n]), () => {
              setInput('');
              setQ('');
              setNiche(niche === n ? '' : n);
            }, n),
          )}
          <span className="mx-1 w-px self-stretch bg-line" />
          {MOODS.map((m) =>
            chip(!q && mood === m, t(moodKey[m]), () => {
              setInput('');
              setQ('');
              setMood(mood === m ? '' : m);
            }, m),
          )}
        </div>
      </div>

      <div ref={scrollRef} className={mode === 'pick' ? 'scrollbar-thin max-h-[48vh] overflow-y-auto pr-1' : ''}>
        <div className={`grid gap-2 ${mode === 'pick' ? 'grid-cols-3 sm:grid-cols-4' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4'}`}>
          {items.map((i) => {
            const isSel = selected.some((s) => s.id === i.id);
            return (
              <button
                key={i.id}
                type="button"
                onClick={() => (mode === 'pick' ? toggle(i) : onOpen?.(i))}
                title={i.title}
                className={`group relative aspect-square overflow-hidden rounded-xl border-2 bg-bg text-left ${isSel ? 'border-accent shadow-glow-sm' : 'border-transparent'}`}
              >
                <img src={i.thumb} alt={i.title} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" loading="lazy" />
                {i.kind === 'video' && (
                  <span className="absolute left-1.5 top-1.5 flex items-center gap-1 rounded-md bg-black/70 px-1.5 py-0.5 text-[11px]">
                    <Play size={10} className="fill-white" /> {i.duration ? `${i.duration}s` : ''}
                  </span>
                )}
                {isSel && (
                  <span className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-accent text-xs font-bold">
                    {selected.findIndex((s) => s.id === i.id) + 1}
                  </span>
                )}
                {i.credit?.name && (
                  <span className="absolute inset-x-0 bottom-0 flex items-center gap-1 truncate bg-gradient-to-t from-black/85 to-transparent px-1.5 pb-1 pt-4 text-[10px] text-white/85">
                    <Camera size={10} className="shrink-0" />
                    <span className="truncate">
                      {i.credit.name} · {i.credit.source}
                    </span>
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div ref={sentinelRef} className="h-4" />
        {loading && (
          <div className="py-4 text-center">
            <Spinner />
          </div>
        )}
        {!loading && failed && <p className="py-4 text-center text-sm text-red-300">{t('media.error')}</p>}
        {!loading && !failed && items.length === 0 && <p className="py-6 text-center text-sm text-muted">{t('common.nothingFound')}</p>}
        {!loading && done && items.length > 0 && <p className="py-3 text-center text-[12px] text-muted">{t('media.end')}</p>}
      </div>

      {mode === 'pick' && (
        <div className="sticky bottom-0 -mx-1 space-y-2 border-t border-line bg-card px-1 pt-3">
          {selected.length > 0 && (
            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin" aria-label={t('media.selected')}>
              {selected.map((s, n) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => toggle(s)}
                  className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-accent/60"
                  title={t('common.remove')}
                >
                  <img src={s.thumb} alt={s.title} className="h-full w-full object-cover" />
                  <span className="absolute left-0.5 top-0.5 rounded bg-black/70 px-1 text-[10px] font-bold">{n + 1}</span>
                  <X size={12} className="absolute right-0.5 top-0.5 rounded bg-black/70" />
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            className="btn-primary w-full"
            disabled={selected.length === 0}
            onClick={() => {
              onAdd?.(selected.map(toMediaItem));
              setSelected([]);
            }}
          >
            <Check size={16} /> {t('visual.addSelected', { n: selected.length })} →
          </button>
        </div>
      )}
      {(items.some((i) => i.credit?.source === 'Pexels') || mode === 'browse') && (
        <p className="text-[11px] text-muted">
          {t('media.poweredBy')}{' '}
          <a className="underline hover:text-white" href="https://www.pexels.com" target="_blank" rel="noreferrer">
            Pexels
          </a>
        </p>
      )}
    </div>
  );
}
