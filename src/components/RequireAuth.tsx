import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { Spinner } from './Spinner';

export function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthed, loading } = useAuth();
  const location = useLocation();
  if (!isAuthed) return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
  if (loading) return <Spinner full />;
  return <>{children}</>;
}
