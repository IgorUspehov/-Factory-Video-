import { Link } from 'react-router-dom';
import { useI18n } from '../i18n';

export default function NotFound() {
  const { t } = useI18n();
  return (
    <section className="mx-auto flex max-w-xl flex-col items-center px-4 py-28 text-center">
      <div className="h-display text-7xl text-gradient">404</div>
      <h1 className="h-display mt-4 text-2xl">{t('notFound.title')}</h1>
      <p className="mt-2 text-muted">{t('notFound.text')}</p>
      <Link to="/" className="btn-primary mt-8">
        {t('notFound.home')} →
      </Link>
    </section>
  );
}
