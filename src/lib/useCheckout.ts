import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from './api';
import { useAuth } from './auth';

/** Starts a Polar checkout (or the customer portal) and follows the returned URL. */
export function useCheckout() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { refresh } = useAuth();

  const follow = async (url: string) => {
    const target = new URL(url, window.location.origin);
    if (target.origin === window.location.origin) {
      await refresh();
      navigate(`${target.pathname}${target.search}`);
    } else {
      window.open(target.toString(), '_blank', 'noopener');
    }
  };

  const run = async (fn: () => Promise<{ url: string }>) => {
    setBusy(true);
    setError(null);
    try {
      await follow((await fn()).url);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return {
    busy,
    error,
    checkout: (product: 'pro' | 'credits') => run(() => api.checkout(product)),
    portal: () => run(() => api.portal()),
  };
}
