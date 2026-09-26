import { useEffect } from 'react';
import { useEditor } from '../EditorContext';
import { useI18n, type TKey } from '../../i18n';
import { GOOGLE_FONTS } from '../../lib/project';
import { transitionKey } from '../../lib/labels';
import type { StyleSettings, Transition } from '../../types';

const TRANSITIONS: Transition[] = ['cut', 'fade', 'zoom', 'slide'];
const FONT_LINK_ID = 'fv-style-fonts';

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

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-line px-3 py-2.5 text-sm">
      {label}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition ${checked ? 'bg-accent shadow-glow-sm' : 'bg-line'}`}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`} />
      </button>
    </label>
  );
}

export function StylePanel() {
  const { project, update } = useEditor();
  const { t } = useI18n();
  const s = project.style;
  useStyleFonts();
  const set = (patch: Partial<StyleSettings>) => update((p) => ({ style: { ...p.style, ...patch } }));

  const colors: { key: 'background' | 'accent' | 'text'; label: TKey }[] = [
    { key: 'background', label: 'style.background' },
    { key: 'accent', label: 'style.accent' },
    { key: 'text', label: 'style.text' },
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

      <div>
        <div className="label-caps mb-2">{t('style.colors')}</div>
        <div className="grid grid-cols-3 gap-2">
          {colors.map((c) => (
            <label key={c.key} className="rounded-xl border border-line p-2 text-center">
              <input type="color" value={s[c.key]} onChange={(e) => set({ [c.key]: e.target.value })} className="h-10 w-full cursor-pointer" />
              <span className="mt-1.5 block text-[11px] text-muted">{t(c.label)}</span>
              <span className="block font-mono text-[10px] uppercase">{s[c.key]}</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <div className="label-caps mb-2">{t('style.font')}</div>
        <div className="grid grid-cols-2 gap-1.5">
          {GOOGLE_FONTS.map((f) => (
            <button
              key={f}
              onClick={() => set({ font: f })}
              className={`truncate rounded-xl border px-3 py-2 text-left text-sm transition ${
                s.font === f ? 'border-accent bg-accent/10 shadow-glow-sm' : 'border-line hover:border-accent/50'
              }`}
              style={{ fontFamily: `'${f}', sans-serif` }}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="label-caps mb-2">{t('style.transition')}</div>
        <div className="grid grid-cols-4 gap-1 rounded-xl border border-line bg-bg p-1">
          {TRANSITIONS.map((tr) => (
            <button
              key={tr}
              onClick={() => set({ transition: tr })}
              className={`rounded-lg py-2 text-xs font-semibold transition ${s.transition === tr ? 'bg-accent/15 text-accent-light' : 'text-muted hover:text-white'}`}
            >
              {t(transitionKey[tr])}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Toggle label={t('style.kenBurns')} checked={s.kenBurns} onChange={(v) => set({ kenBurns: v })} />
        <Toggle label={t('style.beatSync')} checked={s.beatSync} onChange={(v) => set({ beatSync: v })} />
        <Toggle label={t('style.fadeIn')} checked={s.audioFadeIn} onChange={(v) => set({ audioFadeIn: v })} />
        <Toggle label={t('style.fadeOut')} checked={s.audioFadeOut} onChange={(v) => set({ audioFadeOut: v })} />
      </div>
    </div>
  );
}
