import { useState } from 'react';
import { MonitorDown, Share, SquarePlus } from 'lucide-react';
import { usePwa } from '../lib/pwa';
import { useI18n } from '../i18n';
import { Modal } from './Modal';

export function InstallButton({ variant = 'button', onDone }: { variant?: 'button' | 'menu' | 'icon'; onDone?: () => void }) {
  const { installed, canPrompt, install } = usePwa();
  const { t } = useI18n();
  const [help, setHelp] = useState(false);
  if (installed) return null;

  const onClick = async () => {
    if (canPrompt) await install();
    else setHelp(true);
    onDone?.();
  };

  return (
    <>
      {variant === 'menu' ? (
        <button onClick={onClick} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-white/90 hover:bg-white/5">
          <MonitorDown size={16} className="text-accent-light" />
          {t('pwa.install')}
        </button>
      ) : variant === 'icon' ? (
        <button onClick={onClick} className="btn-ghost p-2" title={t('pwa.install')} aria-label={t('pwa.install')}>
          <MonitorDown size={18} />
        </button>
      ) : (
        <button onClick={onClick} className="btn-secondary btn-sm">
          <MonitorDown size={15} className="text-accent-light" />
          {t('pwa.install')}
        </button>
      )}
      <Modal open={help} onClose={() => setHelp(false)} title={t('pwa.helpTitle')}>
        <ol className="space-y-4 text-sm text-white/80">
          <li className="flex gap-3">
            <span className="icon-tile h-9 w-9">
              <Share size={16} />
            </span>
            <span>{t('pwa.helpIos')}</span>
          </li>
          <li className="flex gap-3">
            <span className="icon-tile h-9 w-9">
              <SquarePlus size={16} />
            </span>
            <span>{t('pwa.helpAndroid')}</span>
          </li>
          <li className="flex gap-3">
            <span className="icon-tile h-9 w-9">
              <MonitorDown size={16} />
            </span>
            <span>{t('pwa.helpDesktop')}</span>
          </li>
        </ol>
      </Modal>
    </>
  );
}
