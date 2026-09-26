import { Droplets } from 'lucide-react';
import { useI18n } from '../i18n';
import { useCheckout } from '../lib/useCheckout';

export function WatermarkNotice({ compact = false }: { compact?: boolean }) {
  const { t } = useI18n();
  const { checkout, busy } = useCheckout();
  return (
    <div className={`flex flex-col gap-3 rounded-2xl border border-accent/40 bg-accent/[0.07] ${compact ? 'p-3' : 'p-4 sm:flex-row sm:items-center'}`}>
      <div className="flex items-start gap-3">
        <span className="icon-tile h-9 w-9">
          <Droplets size={16} />
        </span>
        <div>
          <div className="text-sm font-semibold">{t('watermark.title')}</div>
          <div className="text-xs text-muted">{t('watermark.text')}</div>
        </div>
      </div>
      <button className={`btn-primary btn-sm ${compact ? '' : 'sm:ml-auto'}`} disabled={busy} onClick={() => checkout('pro')}>
        {t('watermark.cta')} →
      </button>
    </div>
  );
}
