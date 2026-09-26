import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { User } from '../types';
import { api, ApiError, tokenStore } from './api';

interface AuthValue {
  user: User | null;
  loading: boolean;
  isAuthed: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(tokenStore.get);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(!!token);

  const refresh = useCallback(async () => {
    if (!tokenStore.get()) {
      setUser(null);
      return;
    }
    try {
      setUser(await api.me());
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        tokenStore.clear();
        setToken(null);
        setUser(null);
      }
    }
  }, []);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    refresh().finally(() => setLoading(false));
  }, [token, refresh]);

  const applyToken = useCallback(async (t: string) => {
    tokenStore.set(t);
    setToken(t);
    setUser(await api.me());
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      user,
      loading,
      isAuthed: !!token,
      login: async (email, password) => applyToken((await api.login(email, password)).token),
      register: async (email, password) => applyToken((await api.register(email, password)).token),
      logout: async () => {
        try {
          await api.logout();
        } finally {
          tokenStore.clear();
          setToken(null);
          setUser(null);
        }
      },
      refresh,
    }),
    [user, loading, token, applyToken, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
