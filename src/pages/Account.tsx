import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CalendarClock, CheckCircle2, Crown, CreditCard, History, LogOut, Mail, Settings, Zap } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { api } from '../lib/api';
import { useCheckout } from '../lib/useCheckout';
import { useI18n, type TKey } from '../i18n';
import { PlanBadge } from '../components/PlanBadge';
import { Spinner } from '../components/Spinner';
import { formatPrice, pricing } from '../config/pricing';
import type { BillingHistoryItem } from '../types';
import { statusKey } from '../lib/labels';


export default function Account() {
  const { t, formatDate, locale } = useI18n();
  const { user, logout } = useAuth();
  const { checkout, portal, busy, error } = useCheckout();
  const [history, setHistory] = useState<BillingHistoryItem[] | null>(null);
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    api.billingHistory().then(setHistory).catch(() => setHistory([]));
  }, []);

  const notice: TKey | null =
    params.get('checkout') === 'success'
      ? params.get('product') === 'pro'
        ? 'account.notice.pro'
        : 'account.notice.credits'
      : params.get('portal')
        ? 'account.notice.portal'
        : null;

  if (!user) return <Spinner full />;

  return (
    <section className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="label-caps mb-3">{t('account.kicker')}</div>
      <h1 className="h-display text-3xl sm:text-4xl">
        {t('account.title1')} <span className="text-gradient">{t('account.title2')}</span>
      </h1>

      {notice && (
        <div className="mt-6 flex items-center gap-3 rounded-2xl border border-accent/50 bg-accent/10 p-4 text-sm">
          <CheckCircle2 size={18} className="shrink-0 text-accent" />
          <span className="flex-1">{t(notice)}</span>
          <button className="btn-ghost btn-sm" onClick={() => setParams({})}>
            {t('common.close')}
          </button>
        </div>
      )}
      {error && <p className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">{t('auth.errors.generic')}</p>}

      <div className="mt-8 grid gap-5 md:grid-cols-3">
        <div className="card p-6">
          <span className="icon-tile h-10 w-10">
            <Mail size={18} />
          </span>
          <div className="label-caps mt-4">{t('auth.email')}</div>
          <div className="mt-1 truncate font-semibold">{user.email}</div>
        </div>
        <div className="card p-6">
          <span className="icon-tile h-10 w-10">
            <Crown size={18} />
          </span>
          <div className="label-caps mt-4">{t('account.plan')}</div>
          <div className="mt-2 flex items-center gap-2">
            <PlanBadge plan={user.plan} />
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs text-muted">
            <CalendarClock size={14} />
            {user.plan === 'pro' ? t('account.renews', { date: formatDate(user.renewsAt) }) : t('account.noRenewal')}
          </div>
        </div>
        <div className="card p-6">
          <span className="icon-tile h-10 w-10">
            <Zap size={18} />
          </span>
          <div className="label-caps mt-4">{t('account.credits')}</div>
          <div className="h-display mt-1 text-3xl tabular-nums">{user.credits}</div>
        </div>
      </div>

      <div className="mt-5 grid gap-5 md:grid-cols-2">
        {user.plan === 'free' ? (
          <div className="card border-accent/60 p-6 shadow-glow-sm">
            <h2 className="font-display text-xl font-bold">{t('account.upgradeTitle')}</h2>
            <p className="mt-2 text-sm text-muted">
              {t('account.upgradeText', { n: pricing.pro.creditsPerMonth, price: formatPrice(pricing.pro.priceMonthly, locale) })}
            </p>
            <button className="btn-primary mt-5" disabled={busy} onClick={() => checkout('pro')}>
              <Crown size={16} /> {t('account.upgrade')} →
            </button>
          </div>
        ) : (
          <div className="card p-6">
            <h2 className="font-display text-xl font-bold">{t('account.manageTitle')}</h2>
            <p className="mt-2 text-sm text-muted">{t('account.manageText')}</p>
            <button className="btn-secondary mt-5" disabled={busy} onClick={() => portal()}>
              <Settings size={16} /> {t('account.manage')}
            </button>
          </div>
        )}
        <div className="card p-6">
          <h2 className="font-display text-xl font-bold">{t('account.buyTitle')}</h2>
          <p className="mt-2 text-sm text-muted">
            {t('account.buyText', { n: pricing.credits.packCredits, price: formatPrice(pricing.credits.packPrice, locale) })}
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <button className="btn-secondary" disabled={busy} onClick={() => checkout('credits')}>
              <CreditCard size={16} /> {t('account.buyCredits')}
            </button>
            {user.plan === 'free' && (
              <button className="btn-ghost" disabled={busy} onClick={() => portal()}>
                <Settings size={16} /> {t('account.manage')}
              </button>
            )}
          </div>
          <p className="mt-3 text-[11px] text-muted">{t('account.polar')}</p>
        </div>
      </div>

      <div className="card mt-5 p-6">
        <div className="flex items-center gap-3">
          <span className="icon-tile h-10 w-10">
            <History size={18} />
          </span>
          <h2 className="font-display text-xl font-bold">{t('account.history')}</h2>
        </div>
        {history === null ? (
          <div className="py-8 text-center">
            <Spinner />
          </div>
        ) : history.length === 0 ? (
          <p className="mt-5 text-sm text-muted">{t('account.historyEmpty')}</p>
        ) : (
          <div className="scrollbar-thin mt-5 overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead>
                <tr className="label-caps">
                  <th className="pb-3 font-semibold">{t('account.col.date')}</th>
                  <th className="pb-3 font-semibold">{t('account.col.project')}</th>
                  <th className="pb-3 font-semibold">{t('account.col.format')}</th>
                  <th className="pb-3 font-semibold">{t('account.col.credits')}</th>
                  <th className="pb-3 font-semibold">{t('account.col.status')}</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id} className="border-t border-line">
                    <td className="py-3 text-muted">{formatDate(h.date, true)}</td>
                    <td className="py-3">
                      <Link to={`/export/${h.projectId}`} className="hover:text-accent-light">
                        {h.projectTitle || t('projects.untitled')}
                      </Link>
                    </td>
                    <td className="py-3">{h.format}</td>
                    <td className="py-3 tabular-nums">−{h.credits}</td>
                    <td className="py-3">
                      <span className={h.status === 'done' ? 'text-accent-light' : 'text-muted'}>{t(statusKey[h.status])}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <button
        className="btn-secondary mt-8"
        onClick={async () => {
          await logout();
          navigate('/');
        }}
      >
        <LogOut size={16} /> {t('nav.logout')}
      </button>
    </section>
  );
}
