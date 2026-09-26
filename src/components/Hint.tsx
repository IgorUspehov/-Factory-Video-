import { useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { useI18n } from '../i18n';

/** Short plain-language explanation under a control. */
export function Hint({ children }: { children: ReactNode }) {
  return <p className="mt-1.5 text-[13px] leading-snug text-muted">{children}</p>;
}

/** Collapsible section for optional settings ("Advanced"). */
export function Advanced({ children, defaultOpen = false, note }: { children: ReactNode; defaultOpen?: boolean; note?: string }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl border border-line">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex min-h-[48px] w-full items-center justify-between gap-3 px-4 py-3 text-left"
        title={t('common.advancedHint')}
      >
        <span>
          <span className="block font-semibold">{t('common.advanced')}</span>
          {note && <span className="block text-[13px] text-muted">{note}</span>}
        </span>
        <ChevronDown size={18} className={`shrink-0 text-accent transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="space-y-5 border-t border-line p-4">{children}</div>}
    </div>
  );
}
