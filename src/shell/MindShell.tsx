import { useEffect, useRef } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { QuietMessage } from '@/components/QuietMessage';
import { installSoundGesture, playDoor } from '@/lib/sound';
import { reloadIfUpdatePending } from '@/app/updates';
import { CaptureSheet } from './CaptureSheet';
import { Crumbs } from './Crumbs';
import { Dock } from './Dock';
import { useCapture } from './focus';
import { GearIcon } from './icons';
import { MovedIn } from './MovedIn';
import { SkyBackdrop } from './SkyBackdrop';
import '@/components/Field.css';
import '@/components/Instrument.css';
import './shell.css';

const typing = (el: EventTarget | null) => el instanceof HTMLElement && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));

/** The sky behind, a place in front, the dock below. */
export function MindShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const openCapture = useCapture((s) => s.openCapture);
  const captureOpen = useCapture((s) => s.open);
  const isSky = location.pathname === '/';

  useEffect(() => installSoundGesture(), []);
  const firstRoute = useRef(true);
  useEffect(() => {
    if (firstRoute.current) { firstRoute.current = false; return; }
    if (reloadIfUpdatePending()) return;
    playDoor();
  }, [location.pathname]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (captureOpen || typing(e.target) || e.altKey) return;
      if ((e.key === 'n' || e.key === 'N') && !e.metaKey && !e.ctrlKey) { e.preventDefault(); openCapture(); }
      else if (e.key === '/' || (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey))) { e.preventDefault(); navigate('/search'); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [captureOpen, openCapture, navigate]);

  return (
    <div className="mshell">
      <a href="#place" className="visually-hidden">Skip to content</a>
      <div className="mshell__sky"><SkyBackdrop /></div>
      <div className="mshell__vignette" aria-hidden="true" />
      <header className="mshell__hud">
        <Crumbs />
        <div className="mshell__tools">
          <Link to="/settings" className="iconlink" aria-label="Settings"><GearIcon /></Link>
        </div>
      </header>
      <main id="place" className={`mshell__main ${isSky ? 'mshell__main--sky' : ''}`} key={location.pathname}>
        <Outlet />
      </main>
      <Dock />
      <CaptureSheet />
      <MovedIn />
      <QuietMessage />
    </div>
  );
}
