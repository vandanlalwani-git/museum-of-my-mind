import { registerSW } from 'virtual:pwa-register';
import { useUiStore } from '@/store/ui';

export function setupPWA() {
  if (import.meta.env.DEV) return;
  const update = registerSW({
    onNeedRefresh() {
      useUiStore.getState().say('A newer wing has been built. Reload to visit it.', 12_000, { quiet: true });
      // A future settings control can call update(true). For now we surface the message only.
      void update;
    },
    onOfflineReady() {
      useUiStore.getState().say('The museum is ready to open without a connection.', 6000, { quiet: true });
    },
  });
}
