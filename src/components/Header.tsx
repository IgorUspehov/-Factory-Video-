import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown, FolderOpen, LogOut, Menu, User as UserIcon, X } from 'lucide-react';
import { Logo } from './Logo';
import { LangSwitcher } from './LangSwitcher';
import { InstallButton } from './InstallButton';
import { CreditsBadge, PlanBadge } from './PlanBadge';
import { useAuth } from '../lib/auth';
import { useI18n, type TKey } from '../i18n';

const guestLinks: { to: string; label: TKey }[] = [
  { to: '/#examples', label: 'nav.examples' },
  { to: '/#pricing', label: 'nav.pricing' },
  { to: '/#faq', label: 'nav.faq' },
];
const userLinks: { to: string; label: TKey }[] = [
  { to: '/projects', label: 'nav.projects' },
  { to: '/library', label: 'nav.library' },
  { to: '/start', label: 'nav.newProject' },
];

export function Header() {
  const { t } = useI18n();
  const { user, isAuthed, logout } = useAuth();
  const [menu, setMenu] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const links = isAuthed ? userLinks : guestLinks;

  useEffect(() => {
    setMenu(false);
    setDrawer(false);
  }, [location.pathname, location.hash]);

  useEffect(() => {
    if (!menu) return;
    const onDown = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenu(false);
    };
    window.addEventListener('pointerdown', onDown);
    return () => window.removeEventListener('pointerdown', onDown);
  }, [menu]);

  const doLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <header className="sticky top-0 z-50 border-b border-line/70 bg-bg/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
        <Logo caption />
        <nav className="ml-6 hidden items-center gap-1 lg:flex">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) =>
                `rounded-xl px-3 py-2 text-sm transition ${isActive && !l.to.includes('#') ? 'text-white' : 'text-muted hover:text-white'}`
              }
            >
              {t(l.label)}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <LangSwitcher className="hidden sm:inline-flex" />
          <div className="hidden md:block">
            <InstallButton />
          </div>

          {isAuthed ? (
            <>
              {user && (
                <Link to="/account" className="hidden items-center gap-1.5 sm:flex" title={t('nav.account')}>
                  <PlanBadge plan={user.plan} />
                  <CreditsBadge credits={user.credits} />
                </Link>
              )}
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setMenu((v) => !v)}
                  className="flex items-center gap-1 rounded-full border border-line p-0.5 pr-1.5 transition hover:border-accent/60"
                  aria-haspopup="menu"
                  aria-expanded={menu}
                  aria-label={t('nav.profileMenu')}
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-accent to-accent-light font-display text-sm font-extrabold text-bg">
                    {(user?.email ?? '?').charAt(0).toUpperCase()}
                  </span>
                  <ChevronDown size={14} className="text-muted" />
                </button>
                {menu && (
                  <div role="menu" className="card absolute right-0 top-12 w-64 p-2 shadow-2xl">
                    {user && (
                      <div className="border-b border-line px-3 pb-3 pt-1">
                        <div className="truncate text-sm font-medium">{user.email}</div>
                        <div className="mt-2 flex items-center gap-1.5">
                          <PlanBadge plan={user.plan} />
                          <CreditsBadge credits={user.credits} />
                        </div>
                      </div>
                    )}
                    <div className="pt-2">
                      <Link to="/account" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm hover:bg-white/5">
                        <UserIcon size={16} className="text-accent-light" />
                        {t('nav.account')}
                      </Link>
                      <Link to="/projects" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm hover:bg-white/5">
                        <FolderOpen size={16} className="text-accent-light" />
                        {t('nav.myProjects')}
                      </Link>
                      <InstallButton variant="menu" />
                      <button onClick={doLogout} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm hover:bg-white/5">
                        <LogOut size={16} className="text-accent-light" />
                        {t('nav.logout')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <Link to="/login" className="btn-ghost hidden sm:inline-flex">
                {t('nav.login')}
              </Link>
              <Link to="/start" className="btn-primary btn-sm hidden sm:inline-flex">
                {t('nav.createProject')} →
              </Link>
            </>
          )}

          <button className="btn-ghost p-2 lg:hidden" onClick={() => setDrawer((v) => !v)} aria-label={t('nav.menu')} aria-expanded={drawer}>
            {drawer ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {drawer && (
        <div className="border-t border-line bg-bg px-4 pb-5 pt-3 lg:hidden">
          <nav className="flex flex-col">
            {links.map((l) => (
              <Link key={l.to} to={l.to} className="rounded-xl px-3 py-3 text-base text-white/90 hover:bg-white/5">
                {t(l.label)}
              </Link>
            ))}
          </nav>
          <div className="mt-3 flex flex-wrap items-center gap-3 px-3">
            <LangSwitcher />
            <InstallButton />
          </div>
          {!isAuthed && (
            <div className="mt-4 grid grid-cols-2 gap-3 px-3">
              <Link to="/login" className="btn-secondary">
                {t('nav.login')}
              </Link>
              <Link to="/start" className="btn-primary">
                {t('nav.createProject')} →
              </Link>
            </div>
          )}
          {isAuthed && user && (
            <Link to="/account" className="mt-4 flex items-center gap-2 px-3">
              <PlanBadge plan={user.plan} />
              <CreditsBadge credits={user.credits} />
            </Link>
          )}
        </div>
      )}
    </header>
  );
}
