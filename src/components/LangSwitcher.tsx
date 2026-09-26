import { LANGS, useI18n } from '../i18n';

export function LangSwitcher({ className = '' }: { className?: string }) {
  const { lang, setLang, t } = useI18n();
  return (
    <div className={`inline-flex rounded-xl border border-line bg-bg p-0.5 ${className}`} role="group" aria-label={t('nav.language')}>
      {LANGS.map((l) => (
        <button
          key={l}
          onClick={() => setLang(l)}
          aria-pressed={lang === l}
          className={`rounded-[10px] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider transition ${
            lang === l ? 'bg-accent/15 text-accent-light shadow-glow-sm' : 'text-muted hover:text-white'
          }`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
