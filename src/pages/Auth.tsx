import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { api, ApiError } from '../lib/api';
import { useI18n, type TKey } from '../i18n';
import { LogoMark } from '../components/Logo';
import { Modal } from '../components/Modal';
import { landingPhotos, unsplash } from '../lib/libraryData';

function errorKey(err: unknown): TKey {
  if (err instanceof ApiError) {
    if (err.message === 'invalid_email') return 'auth.errors.email';
    if (err.message === 'weak_password') return 'auth.errors.password';
    if (err.status === 409) return 'auth.errors.exists';
    if (err.status === 401) return 'auth.errors.credentials';
  }
  return 'auth.errors.generic';
}

function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const { t } = useI18n();
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState<TKey | null>(null);
  const [busy, setBusy] = useState(false);
  const [forgot, setForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError('auth.errors.password');
      return;
    }
    setBusy(true);
    try {
      await (mode === 'login' ? login(email, password) : register(email, password));
      navigate(from ?? (mode === 'register' ? '/start' : '/projects'), { replace: true });
    } catch (err) {
      setError(errorKey(err));
    } finally {
      setBusy(false);
    }
  };

  const sendReset = async (e: FormEvent) => {
    e.preventDefault();
    await api.forgotPassword(forgotEmail).catch(() => undefined);
    setForgotSent(true);
  };

  return (
    <section className="mx-auto grid min-h-[calc(100dvh-4rem)] max-w-6xl items-center gap-10 px-4 py-12 sm:px-6 lg:grid-cols-2">
      <div className="relative hidden overflow-hidden rounded-[20px] border border-line lg:block">
        <img src={unsplash(landingPhotos.mic, 900, 1100)} alt="" className="h-[560px] w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/30 to-transparent" />
        <div className="absolute bottom-8 left-8 right-8">
          <h2 className="h-display text-4xl">
            {t('landing.hero.title1')}
            <br />
            <span className="text-gradient">{t('landing.hero.title2')}</span>
          </h2>
          <div className="hand mt-3 text-2xl">{t('landing.hero.hand')}</div>
        </div>
      </div>

      <div className="card mx-auto w-full max-w-md p-7 sm:p-9">
        <LogoMark size={40} />
        <h1 className="h-display mt-6 text-3xl">{t(mode === 'login' ? 'auth.loginTitle' : 'auth.registerTitle')}</h1>
        <p className="mt-2 text-sm text-muted">{t(mode === 'login' ? 'auth.loginSubtitle' : 'auth.registerSubtitle')}</p>
        {from && <p className="mt-3 rounded-xl border border-accent/40 bg-accent/10 px-3 py-2 text-xs text-accent-light">{t('auth.needLogin')}</p>}

        <form onSubmit={submit} className="mt-7 space-y-4" noValidate>
          <label className="block">
            <span className="label-caps">{t('auth.email')}</span>
            <div className="relative mt-2">
              <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
              <input
                type="email"
                autoComplete="email"
                required
                className="input pl-11"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </label>
          <label className="block">
            <span className="label-caps">{t('auth.password')}</span>
            <div className="relative mt-2">
              <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
              <input
                type={show ? 'text' : 'password'}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                required
                minLength={6}
                className="input pl-11 pr-11"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted hover:text-white"
                onClick={() => setShow((v) => !v)}
                aria-label={t(show ? 'auth.hidePassword' : 'auth.showPassword')}
              >
                {show ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </label>
          {mode === 'login' && (
            <div className="text-right">
              <button type="button" className="text-xs text-accent-light hover:underline" onClick={() => setForgot(true)}>
                {t('auth.forgot')}
              </button>
            </div>
          )}
          {error && <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">{t(error)}</p>}
          <button className="btn-primary w-full py-3.5" disabled={busy}>
            {t(mode === 'login' ? 'auth.loginCta' : 'auth.registerCta')} →
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted">
          {t(mode === 'login' ? 'auth.noAccount' : 'auth.haveAccount')}{' '}
          <Link to={mode === 'login' ? '/register' : '/login'} state={location.state} className="font-semibold text-accent-light hover:underline">
            {t(mode === 'login' ? 'auth.registerLink' : 'auth.loginLink')}
          </Link>
        </p>
      </div>

      <Modal
        open={forgot}
        onClose={() => {
          setForgot(false);
          setForgotSent(false);
        }}
        title={t('auth.forgotTitle')}
      >
        {forgotSent ? (
          <p className="text-sm text-white/80">{t('auth.forgotSent')}</p>
        ) : (
          <form onSubmit={sendReset} className="space-y-4">
            <p className="text-sm text-muted">{t('auth.forgotText')}</p>
            <input type="email" required className="input" placeholder="name@example.com" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} />
            <button className="btn-primary w-full">{t('auth.forgotCta')} →</button>
          </form>
        )}
      </Modal>
    </section>
  );
}

export const Login = () => <AuthForm mode="login" />;
export const Register = () => <AuthForm mode="register" />;
