import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AppShell } from './AppShell';
import { ErrorBoundary } from './ErrorBoundary';
import { RequireMuseum } from './RequireMuseum';
import { Entrance } from '@/rooms/entrance/Entrance';
import { useMuseumStore } from '@/store/museum';
import { useSettingsStore } from '@/store/settings';

const Observatory = lazy(() => import('@/rooms/observatory/Observatory'));
const Archive = lazy(() => import('@/rooms/archive/Archive'));
const Workshop = lazy(() => import('@/rooms/workshop/Workshop'));
const FutureGallery = lazy(() => import('@/rooms/future/FutureGallery'));
const Cabinet = lazy(() => import('@/rooms/cabinet/Cabinet'));
const Settings = lazy(() => import('@/rooms/settings/Settings'));
const Reflect = lazy(() => import('@/rooms/reflect/Reflect'));

function Booting() {
  return (
    <div className="booting" aria-busy="true">
      <span className="plaque">Unlocking the doors</span>
    </div>
  );
}

export function App() {
  const boot = useMuseumStore((s) => s.boot);
  const status = useMuseumStore((s) => s.status);
  const error = useMuseumStore((s) => s.error);
  const loadSettings = useSettingsStore((s) => s.load);

  useEffect(() => {
    void loadSettings();
    void boot().then(async () => {
      // Dev-only inspection hook: `?enter=demo` opens a museum straight away in a fresh profile.
      if (!import.meta.env.DEV) return;
      const id = new URLSearchParams(location.search).get('enter');
      if (id) await useMuseumStore.getState().enter(id).catch(() => undefined);
    });
  }, [boot, loadSettings]);

  if (status === 'error') {
    return (
      <main style={{ padding: 'var(--space-10)', maxWidth: 'var(--measure)' }}>
        <span className="plaque">The doors are stuck</span>
        <h1 style={{ fontSize: 'var(--text-2xl)', marginTop: 'var(--space-3)' }}>The museum could not open its storage.</h1>
        <p style={{ color: 'var(--parchment-dim)', marginTop: 'var(--space-4)' }}>
          This usually means the browser is in a private window or has storage disabled. {error}
        </p>
      </main>
    );
  }
  if (status !== 'ready') return <Booting />;

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<Entrance />} />
            <Route element={<RequireMuseum />}>
              <Route path="/observatory" element={<Suspense fallback={<Booting />}><Observatory /></Suspense>} />
              <Route path="/archive" element={<Suspense fallback={<Booting />}><Archive /></Suspense>} />
              <Route path="/workshop" element={<Suspense fallback={<Booting />}><Workshop /></Suspense>} />
              <Route path="/future" element={<Suspense fallback={<Booting />}><FutureGallery /></Suspense>} />
              <Route path="/cabinet" element={<Suspense fallback={<Booting />}><Cabinet /></Suspense>} />
              <Route path="/settings" element={<Suspense fallback={<Booting />}><Settings /></Suspense>} />
              <Route path="/reflect" element={<Suspense fallback={<Booting />}><Reflect /></Suspense>} />
            </Route>
            <Route path="*" element={<Entrance />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
