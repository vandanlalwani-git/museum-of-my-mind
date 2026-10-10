import { Suspense, useEffect } from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { lazyRoom } from './updates';
import { ErrorBoundary } from './ErrorBoundary';
import { useMind } from '@/mind/store';
import { MindShell } from '@/shell/MindShell';
import SkyPlace from '@/places/sky/SkyPlace';
import { useSettingsStore } from '@/store/settings';

const Welcome = lazyRoom(() => import('@/places/welcome/Welcome'));
const Unsorted = lazyRoom(() => import('@/places/unsorted/Unsorted'));
const ClearMind = lazyRoom(() => import('@/places/clear/ClearMind'));
const Search = lazyRoom(() => import('@/places/search/Search'));
const MindSettings = lazyRoom(() => import('@/places/settings/MindSettings'));
const Soon = lazyRoom(() => import('@/places/soon/Soon'));
const GoalPage = lazyRoom(() => import('@/places/goal/GoalPage'));
const ProjectPage = lazyRoom(() => import('@/places/project/ProjectPage'));
const TodayPlace = lazyRoom(() => import('@/places/today/TodayPlace'));

function Booting() {
  return (
    <div className="booting" aria-busy="true">
      <span className="plaque">Unlocking the doors</span>
    </div>
  );
}

/** Places need an open museum; without one, the front door. */
function RequireMind() {
  const mind = useMind((s) => s.mind);
  if (!mind) return <Navigate to="/welcome" replace />;
  return <Outlet />;
}

const lazy = (el: React.ReactNode) => <Suspense fallback={null}>{el}</Suspense>;

export function App() {
  const boot = useMind((s) => s.boot);
  const status = useMind((s) => s.status);
  const error = useMind((s) => s.error);
  const loadSettings = useSettingsStore((s) => s.load);

  useEffect(() => {
    void loadSettings();
    void boot();
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
          <Route path="/welcome" element={lazy(<Welcome />)} />
          <Route element={<RequireMind />}>
            <Route element={<MindShell />}>
              <Route index element={<SkyPlace />} />
              <Route path="/unsorted" element={lazy(<Unsorted />)} />
              <Route path="/clear" element={lazy(<ClearMind />)} />
              <Route path="/search" element={lazy(<Search />)} />
              <Route path="/settings" element={lazy(<MindSettings />)} />
              <Route path="/today" element={lazy(<TodayPlace />)} />
              <Route path="/journal" element={lazy(<Soon title="Journal" note="What happened, and how it felt, with On this day." />)} />
              <Route path="/goal/:id" element={lazy(<GoalPage />)} />
              <Route path="/project/:id" element={lazy(<ProjectPage />)} />
              <Route path="/review" element={lazy(<Soon title="Your week" note="A two-minute Sunday check-in, made on your device." />)} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
