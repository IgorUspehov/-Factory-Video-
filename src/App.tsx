import { lazy, Suspense, useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { RequireAuth } from './components/RequireAuth';
import { Spinner } from './components/Spinner';
import Landing from './pages/Landing';

const Login = lazy(() => import('./pages/Auth').then((m) => ({ default: m.Login })));
const Register = lazy(() => import('./pages/Auth').then((m) => ({ default: m.Register })));
const Account = lazy(() => import('./pages/Account'));
const Start = lazy(() => import('./pages/Start'));
const Editor = lazy(() => import('./pages/Editor'));
const Projects = lazy(() => import('./pages/Projects'));
const Library = lazy(() => import('./pages/Library'));
const Export = lazy(() => import('./pages/Export'));
const NotFound = lazy(() => import('./pages/NotFound'));

function ScrollManager() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) {
      const el = document.getElementById(hash.slice(1));
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
        return;
      }
    }
    window.scrollTo(0, 0);
  }, [pathname, hash]);
  return null;
}

export default function App() {
  const { pathname } = useLocation();
  const isEditor = pathname.startsWith('/editor/');
  const guard = (el: JSX.Element) => <RequireAuth>{el}</RequireAuth>;

  return (
    <div className="flex min-h-[100dvh] flex-col">
      <ScrollManager />
      <Header />
      <main className="flex-1">
        <Suspense fallback={<Spinner full />}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/start" element={guard(<Start />)} />
            <Route path="/editor/:projectId" element={guard(<Editor />)} />
            <Route path="/projects" element={guard(<Projects />)} />
            <Route path="/library" element={guard(<Library />)} />
            <Route path="/export/:projectId" element={guard(<Export />)} />
            <Route path="/account" element={guard(<Account />)} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </main>
      {!isEditor && <Footer />}
    </div>
  );
}
