import { useEffect } from 'react';
import { useEditor } from '../EditorContext';
import { useI18n, type TKey } from '../../i18n';
import { GOOGLE_FONTS } from '../../lib/project';
import { moodKey, transitionKey } from '../../lib/labels';
import { Advanced, Hint } from '../../components/Hint';
import type { StyleSettings, Transition } from '../../types';

const TRANSITIONS: Transition[] = ['cut', 'fade', 'zoom', 'slide'];
const FONT_LINK_ID = 'fv-style-fonts';
/** Fonts that exist as TTF in server/fonts; others are rendered as Inter in the final video. */
const RENDER_FONTS = ['Inter', 'Montserrat', 'Bebas Neue', 'Playfair Display'];

/** Loads the 12 selectable Google Fonts on demand (only inside the editor). */
export function useStyleFonts() {
  useEffect(() => {
    if (document.getElementById(FONT_LINK_ID)) return;
    const link = document.createElement('link');
    link.id = FONT_LINK_ID;
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?${GOOGLE_FONTS.map((f) => `family=${f.replace(/ /g, '+')}`).join('&')}&display=swap`;
    document.head.appendChild(link);
  }, []);
}

function Toggle({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="rounded-xl border border-line px-3 py-2.5" title={hint}>
      <label className="flex min-h-[40px] cursor-pointer items-center justify-between gap-3">
        <span className="font-medium">{label}</span>
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          aria-label={label}
          onClick={() => onChange(!checked)}
          className={`relative h-7 w-12 shrink-0 rounded-full transition ${checked ? 'bg-accent shadow-glow-sm' : 'bg-line'}`}
        >
          <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`} />
        </button>
      </label>
      <p className="text-[13px] leading-snug text-muted">{hint}</p>
    </div>
  );
}

export function StylePanel() {
  const { project, update } = useEditor();
  const { t } = useI18n();
  const s = project.style;
  useStyleFonts();
  const set = (patch: Partial<StyleSettings>) => update((p) => ({ style: { ...p.style, ...patch } }));

  const colors: { key: 'background' | 'accent' | 'text'; label: TKey; hint: TKey }[] = [
    { key: 'background', label: 'style.background', hint: 'style.backgroundHint' },
    { key: 'accent', label: 'style.accent', hint: 'style.accentHint' },
    { key: 'text', label: 'style.text', hint: 'style.textHint' },
  ];

  return (
    <div className="space-y-5">
      <div
        className="flex aspect-video items-center justify-center rounded-2xl border border-line p-4 text-center"
        style={{ background: s.background, fontFamily: `'${s.font}', sans-serif` }}
      >
        <div>
          <div className="text-2xl font-bold" style={{ color: s.text }}>
            {project.lyrics[0]?.text || project.title}
          </div>
          <div className="mx-auto mt-2 h-1 w-16 rounded-full" style={{ background: s.accent, boxShadow: `0 0 12px ${s.accent}` }} />
        </div>
      </div>
      <Hint>{t('style.intro', { mood: t(moodKey[project.mood]) })}</Hint>

      <Toggle label={t('style.beatSync')} hint={t('style.beatSyncHint')} checked={s.beatSync} onChange={(v) => set({ beatSync: v })} />

      <Advanced note={t('style.advancedNote')}>
        <div>
          <div className="label-caps mb-2">{t('style.transition')}</div>
          <div className="grid grid-cols-2 gap-1.5">
            {TRANSITIONS.map((tr) => (
              <button
                key={tr}
                type="button"
                onClick={() => set({ transition: tr })}
                title={t(`style.transitionHints.${tr}`)}
                className={`rounded-xl border px-3 py-2.5 text-left transition ${s.transition === tr ? 'border-accent bg-accent/10 shadow-glow-sm' : 'border-line hover:border-accent/50'}`}
              >
                <span className="block font-semibold">{t(transitionKey[tr])}</span>
                <span className="block text-[12px] leading-snug text-muted">{t(`style.transitionHints.${tr}`)}</span>
              </button>
            ))}
          </div>
        </div>

        <Toggle label={t('style.kenBurns')} hint={t('style.kenBurnsHint')} checked={s.kenBurns} onChange={(v) => set({ kenBurns: v })} />
        <Toggle label={t('style.fadeIn')} hint={t('style.fadeInHint')} checked={s.audioFadeIn} onChange={(v) => set({ audioFadeIn: v })} />
        <Toggle label={t('style.fadeOut')} hint={t('style.fadeOutHint')} checked={s.audioFadeOut} onChange={(v) => set({ audioFadeOut: v })} />

        <div>
          <div className="label-caps mb-2">{t('style.colors')}</div>
          <div className="grid grid-cols-3 gap-2">
            {colors.map((c) => (
              <label key={c.key} className="rounded-xl border border-line p-2 text-center" title={t(c.hint)}>
                <input type="color" value={s[c.key]} onChange={(e) => set({ [c.key]: e.target.value })} className="h-11 w-full cursor-pointer" />
                <span className="mt-1.5 block text-[13px]">{t(c.label)}</span>
                <span className="block font-mono text-[11px] uppercase text-muted">{s[c.key]}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <div className="label-caps mb-2">{t('style.font')}</div>
          <Hint>{t('style.fontHint')}</Hint>
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            {GOOGLE_FONTS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => set({ font: f })}
                className={`min-h-[44px] truncate rounded-xl border px-3 py-2 text-left transition ${
                  s.font === f ? 'border-accent bg-accent/10 shadow-glow-sm' : 'border-line hover:border-accent/50'
                }`}
                style={{ fontFamily: `'${f}', sans-serif` }}
                title={RENDER_FONTS.includes(f) ? f : t('style.fontPreviewOnly')}
              >
                {f}
                {!RENDER_FONTS.includes(f) && <span className="ml-1 font-sans text-[11px] text-muted">*</span>}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-[12px] text-muted">* {t('style.fontPreviewOnly')}</p>
        </div>
      </Advanced>
    </div>
  );
}
