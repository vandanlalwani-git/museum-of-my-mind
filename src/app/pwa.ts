import { registerSW } from 'virtual:pwa-register';
import { useUiStore } from '@/store/ui';

/**
 * The worker updates itself (see `registerType: 'autoUpdate'`). A refreshed
 * version therefore arrives on the next visit without the visitor having to
 * act on a notice, which matters because a failing boot would otherwise hide
 * the very notice that offers the fix.
 */
export function setupPWA() {
  if (import.meta.env.DEV) return;
  registerSW({
    immediate: true,
    onOfflineReady() {
      useUiStore.getState().say('The museum is ready to open without a connection.', 6000, { quiet: true });
    },
  });
}
