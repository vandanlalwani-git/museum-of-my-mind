import { useEffect, useRef } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { QuietMessage } from '@/components/QuietMessage';
import { installSoundGesture, playDoor } from '@/lib/sound';
import { reloadIfUpdatePending } from '@/app/updates';
import { CaptureSheet } from './CaptureSheet';
import { Crumbs } from './Crumbs';
import { Dock } from './Dock';
import { useCapture } from './focus';
import { GearIcon, ListIcon, SkyIcon } from './icons';
import { useMind } from '@/mind/store';
import { parentRoute } from '@/sky/route';
import { useSky } from '@/sky/store';
import { useAutoSync } from '@/sync/useAutoSync';
import { MovedIn } from './MovedIn';
import { DemoNotice } from './DemoNotice';
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
  const isSide = /^\/(goal|project)\//.test(location.pathname);
  const skyLive = useSky((s) => s.live);
  const skyMode = useSky((s) => s.mode);
  const setSkyMode = useSky((s) => s.setMode);
  const peekOpen = useSky((s) => s.peek !== null);
  const setPeek = useSky((s) => s.setPeek);
  const skyInteractive = isSky && skyLive && skyMode === 'sky';
  const movedIn = useMind((s) => !!s.movedIn && s.mind?.kind === 'own');
  const inDemo = useMind((s) => s.mind?.kind === 'demo');
  // While a modal is open, everything behind it is out of reach for fingers, keys and screen readers alike.
  const behind = captureOpen || movedIn;

  useEffect(() => installSoundGesture(), []);
  useAutoSync();
  const firstRoute = useRef(true);
  useEffect(() => {
    if (firstRoute.current) { firstRoute.current = false; return; }
    if (reloadIfUpdatePending()) return;
    playDoor();
  }, [location.pathname]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (captureOpen || typing(e.target) || e.altKey) return;
      if (e.key === 'Escape') {
        if (peekOpen) { setPeek(null); return; }
        const to = parentRoute(location.pathname, location.search, useMind.getState().snap);
        if (to && (isSky || isSide)) { e.preventDefault(); navigate(to); }
        return;
      }
      if ((e.key === 'n' || e.key === 'N') && !e.metaKey && !e.ctrlKey) { e.preventDefault(); openCapture(); }
      else if (e.key === '/' || (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey))) { e.preventDefault(); navigate('/search'); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [captureOpen, openCapture, navigate, location.pathname, location.search, isSky, isSide, peekOpen, setPeek]);

  return (
    <div className={`mshell ${inDemo ? 'mshell--demo' : ''}`}>
      <a href="#place" className="visually-hidden">Skip to content</a>
      <div className="mshell__sky"><SkyBackdrop /></div>
      <div className="mshell__vignette" aria-hidden="true" />
      <header className="mshell__hud" inert={behind}>
        <Crumbs />
        <DemoNotice />
        <div className="mshell__tools">
          {isSky && skyLive && (
            <div className="skytoggle" role="group" aria-label="Show the sky as">
              <button type="button" aria-pressed={skyMode === 'sky'} onClick={() => setSkyMode('sky')}><SkyIcon />Sky</button>
              <button type="button" aria-pressed={skyMode === 'list'} onClick={() => setSkyMode('list')}><ListIcon />List</button>
            </div>
          )}
          <Link to="/settings" className="iconlink" aria-label="Settings"><GearIcon /></Link>
        </div>
      </header>
      <main id="place" inert={behind} className={`mshell__main ${skyInteractive ? 'mshell__main--sky' : ''} ${isSide && skyLive ? 'mshell__main--side' : ''}`} key={location.pathname}>
        <Outlet />
      </main>
      <div inert={behind}><Dock /></div>
      <CaptureSheet />
      <MovedIn />
      <QuietMessage />
    </div>
  );
}
