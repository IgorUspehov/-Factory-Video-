import { Link } from 'react-router-dom';
import { useI18n } from '../i18n';

export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className="drop-shadow-[0_0_10px_rgba(255,106,26,0.55)]">
      <defs>
        <linearGradient id="fv-logo-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FF6A1A" />
          <stop offset="1" stopColor="#FF8A3D" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="60" height="60" rx="17" fill="url(#fv-logo-g)" />
      <path d="M15 38 Q22 25 29 38" fill="none" stroke="#0B0B0D" strokeWidth="5.5" strokeLinecap="round" />
      <path d="M35 38 Q42 25 49 38" fill="none" stroke="#0B0B0D" strokeWidth="5.5" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ caption = false, to = '/' }: { caption?: boolean; to?: string }) {
  const { t } = useI18n();
  return (
    <Link to={to} className="group inline-flex items-center gap-2.5" aria-label="Factory Video">
      <LogoMark />
      <span className="flex flex-col leading-none">
        <span className="font-display text-[17px] font-extrabold tracking-tight">
          Factory <span className="text-gradient">Video</span>
        </span>
        {caption && <span className="label-caps mt-1 text-[8px]">{t('brand.tagline')}</span>}
      </span>
    </Link>
  );
}
