import { Suspense, useEffect } from 'react';
import { lazyRoom } from './updates';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './AppShell';
import { ErrorBoundary } from './ErrorBoundary';
import { RequireMuseum } from './RequireMuseum';
import { Entrance } from '@/rooms/entrance/Entrance';
import Today from '@/rooms/today/Today';
import { useMuseumStore } from '@/store/museum';
import { useSettingsStore } from '@/store/settings';

const Observatory = lazyRoom(() => import('@/rooms/observatory/Observatory'));
const Archive = lazyRoom(() => import('@/rooms/archive/Archive'));
const Workshop = lazyRoom(() => import('@/rooms/workshop/Workshop'));
const FutureGallery = lazyRoom(() => import('@/rooms/future/FutureGallery'));
const Cabinet = lazyRoom(() => import('@/rooms/cabinet/Cabinet'));
const Settings = lazyRoom(() => import('@/rooms/settings/Settings'));
const Reflect = lazyRoom(() => import('@/rooms/reflect/Reflect'));
const Library = lazyRoom(() => import('@/rooms/library/Library'));
const Explore = lazyRoom(() => import('@/rooms/explore/Explore'));

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
        <p style={{ color: 'var(--parchment-dim)', marginTop: 'var(--space-4)' }}>{error}</p>
        <p style={{ color: 'var(--parchment-faint)', marginTop: 'var(--space-4)', fontSize: 'var(--text-sm)' }}>
          A private window with storage disabled will also do this. Your collection is not lost; it is waiting in this browser.
        </p>
        <button type="button" className="instrument instrument--primary" style={{ marginTop: 'var(--space-6)' }} onClick={() => location.reload()}>Try again</button>
      </main>
    );
  }
  if (status !== 'ready') return <Booting />;

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/welcome" element={<Entrance />} />
            <Route element={<RequireMuseum />}>
              <Route index element={<Today />} />
              <Route path="/library" element={<Suspense fallback={<Booting />}><Library /></Suspense>} />
              <Route path="/explore" element={<Suspense fallback={<Booting />}><Explore /></Suspense>} />
              <Route path="/observatory" element={<Suspense fallback={<Booting />}><Observatory /></Suspense>} />
              <Route path="/archive" element={<Suspense fallback={<Booting />}><Archive /></Suspense>} />
              <Route path="/workshop" element={<Suspense fallback={<Booting />}><Workshop /></Suspense>} />
              <Route path="/future" element={<Suspense fallback={<Booting />}><FutureGallery /></Suspense>} />
              <Route path="/cabinet" element={<Suspense fallback={<Booting />}><Cabinet /></Suspense>} />
              <Route path="/settings" element={<Suspense fallback={<Booting />}><Settings /></Suspense>} />
              <Route path="/reflect" element={<Suspense fallback={<Booting />}><Reflect /></Suspense>} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
