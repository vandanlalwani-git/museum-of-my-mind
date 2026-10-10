import { useEffect } from 'react';
import { useMind } from '@/mind/store';
import { loadSync, syncNow, useSync } from './agent';

/**
 * Quiet background sync while the app is open: on start, a few seconds after
 * any change, when the app comes back into view or online, and once a minute.
 * It does nothing at all on a device that has not been paired.
 */
export function useAutoSync() {
  useEffect(() => {
    let timer: number | undefined;
    void loadSync().then(() => syncNow());
    const soon = (ms = 3000) => { window.clearTimeout(timer); timer = window.setTimeout(() => void syncNow(), ms); };
    const onVisible = () => { if (document.visibilityState === 'visible') soon(200); };
    const onOnline = () => soon(200);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onOnline);
    const every = window.setInterval(() => { if (document.visibilityState === 'visible') void syncNow(); }, 60_000);
    const unsubscribe = useMind.subscribe((s, prev) => {
      if (!useSync.getState().state) return;
      if (s.mind?.id !== prev.mind?.id) soon(200);
      else if (s.snap !== prev.snap) soon();
    });
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(every);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onOnline);
      unsubscribe();
    };
  }, []);
}
