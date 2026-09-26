import { Link } from 'react-router-dom';
import { Logo } from './Logo';
import { useI18n } from '../i18n';
import { isMockMode } from '../lib/api';

export function Footer() {
  const { t } = useI18n();
  return (
    <footer className="border-t border-line/70 bg-bg">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Logo caption />
          <p className="mt-4 max-w-xs text-sm text-muted">{t('footer.about')}</p>
        </div>
        <div>
          <div className="label-caps mb-3">{t('footer.product')}</div>
          <ul className="space-y-2 text-sm text-white/80">
            <li><Link to="/start" className="hover:text-accent-light">{t('nav.createProject')}</Link></li>
            <li><Link to="/library" className="hover:text-accent-light">{t('nav.library')}</Link></li>
            <li><Link to="/#pricing" className="hover:text-accent-light">{t('nav.pricing')}</Link></li>
          </ul>
        </div>
        <div>
          <div className="label-caps mb-3">{t('footer.account')}</div>
          <ul className="space-y-2 text-sm text-white/80">
            <li><Link to="/login" className="hover:text-accent-light">{t('nav.login')}</Link></li>
            <li><Link to="/register" className="hover:text-accent-light">{t('auth.registerTitle')}</Link></li>
            <li><Link to="/projects" className="hover:text-accent-light">{t('nav.myProjects')}</Link></li>
          </ul>
        </div>
        <div>
          <div className="label-caps mb-3">{t('footer.help')}</div>
          <ul className="space-y-2 text-sm text-white/80">
            <li><Link to="/#faq" className="hover:text-accent-light">{t('nav.faq')}</Link></li>
            <li><a href="mailto:hello@factory-video.app" className="hover:text-accent-light">{t('footer.contact')}</a></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-line/70">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-5 text-center sm:flex-row sm:px-6">
          <span className="label-caps">© {new Date().getFullYear()} Factory Video · {t('footer.rights')}</span>
          <span className="label-caps">{isMockMode() ? t('footer.demoMode') : t('brand.tagline')}</span>
        </div>
      </div>
    </footer>
  );
}
