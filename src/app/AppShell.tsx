import { useEffect, useRef } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Compass } from '@/components/Compass';
import { QuietMessage } from '@/components/QuietMessage';
import { Instrument } from '@/components/Instrument';
import { useMuseumStore } from '@/store/museum';
import { useUiStore, type BeforeInstallPromptEvent } from '@/store/ui';
import { EASE_OUT_QUINT } from '@/lib/motion';
import { installSoundGesture, playDoor } from '@/lib/sound';
import './AppShell.css';

export function AppShell() {
  const location = useLocation();
  const active = useMuseumStore((s) => s.active);
  const installPrompt = useUiStore((s) => s.installPrompt);
  const setInstallPrompt = useUiStore((s) => s.setInstallPrompt);
  const roomsVisited = useUiStore((s) => s.roomsVisited);
  const noteRoomVisit = useUiStore((s) => s.noteRoomVisit);
  const say = useUiStore((s) => s.say);
  const isEntrance = location.pathname === '/welcome';

  useEffect(() => {
    const onPrompt = (e: Event) => { e.preventDefault(); setInstallPrompt(e as BeforeInstallPromptEvent); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, [setInstallPrompt]);

  useEffect(() => installSoundGesture(), []);
  const firstRoute = useRef(true);
  useEffect(() => {
    if (firstRoute.current) { firstRoute.current = false; return; }
    playDoor();
  }, [location.pathname]);

  useEffect(() => { if (!isEntrance) noteRoomVisit(); }, [location.pathname, isEntrance, noteRoomVisit]);

  const install = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    setInstallPrompt(null);
    say(outcome === 'accepted' ? 'The museum now has a door on your home screen.' : 'The museum stays in the browser for now.');
  };

  return (
    <div className={`shell ${isEntrance ? 'shell--entrance' : ''}`}>
      <a href="#room" className="visually-hidden">Skip to room</a>
      <header className="shell__bar">
        <Link to={active ? "/" : "/welcome"} className="shell__brand">
          <span className="shell__name display">The Museum of My Mind</span>
          {active && <span className="plaque shell__museum">{active.name}</span>}
        </Link>
        {active && <Compass />}
        <div className="shell__tools">
          {installPrompt && roomsVisited > 0 && (
            <Instrument tone="quiet" onClick={install}>Keep this museum</Instrument>
          )}
          {active && (
            <Link to="/explore" className="shell__settings plaque">Explore</Link>
          )}
        </div>
      </header>
      <AnimatePresence mode="wait" initial={false}>
        <motion.main
          id="room"
          key={location.pathname}
          className="shell__room"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.6, ease: EASE_OUT_QUINT }}
        >
          <Outlet />
        </motion.main>
      </AnimatePresence>
      <QuietMessage />
    </div>
  );
}
