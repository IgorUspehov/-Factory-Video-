import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { en, type Dict } from './en';
import { de } from './de';
import { ru } from './ru';

export type Lang = 'de' | 'en' | 'ru';
export const LANGS: Lang[] = ['de', 'en', 'ru'];
export const LOCALES: Record<Lang, string> = { de: 'de-DE', en: 'en-US', ru: 'ru-RU' };

const dicts: Record<Lang, Dict> = { de, en, ru };

type Leaves<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Leaves<T[K], `${P}${K}.`>;
}[keyof T & string];

export type TKey = Leaves<Dict>;
export type TVars = Record<string, string | number>;

const STORAGE_KEY = 'fv_lang';

export function translate(lang: Lang, key: TKey, vars?: TVars): string {
  let node: unknown = dicts[lang];
  for (const part of key.split('.')) node = (node as Record<string, unknown> | undefined)?.[part];
  let out = typeof node === 'string' ? node : key;
  if (vars) for (const [k, v] of Object.entries(vars)) out = out.split(`{${k}}`).join(String(v));
  return out;
}

export function storedLang(): Lang {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'de' || v === 'en' || v === 'ru') return v;
  } catch {
    /* ignore */
  }
  return 'de';
}

interface I18nValue {
  lang: Lang;
  locale: string;
  setLang: (l: Lang) => void;
  t: (key: TKey, vars?: TVars) => string;
  formatDate: (iso: string | null | undefined, withTime?: boolean) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(storedLang);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo<I18nValue>(() => {
    const locale = LOCALES[lang];
    return {
      lang,
      locale,
      setLang,
      t: (key, vars) => translate(lang, key, vars),
      formatDate: (iso, withTime = false) => {
        if (!iso) return '—';
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return '—';
        return d.toLocaleString(locale, withTime ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' });
      },
    };
  }, [lang, setLang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside I18nProvider');
  return ctx;
}
