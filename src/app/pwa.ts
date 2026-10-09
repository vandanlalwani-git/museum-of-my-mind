import { registerSW } from 'virtual:pwa-register';
import { useUiStore } from '@/store/ui';
import { installSafeUpdateMoments, markUpdatePending } from './updates';

/**
 * A new version installs itself in the background. It is switched on at the
 * next safe moment: when the visitor moves to another screen or leaves the
 * app, and never while unsaved words sit in a text field. Reloading the
 * instant it arrived could wipe what someone was typing.
 */
export function setupPWA() {
  if (import.meta.env.DEV) return;
  installSafeUpdateMoments();
  registerSW({
    immediate: true,
    onNeedReload: markUpdatePending,
    onOfflineReady() {
      useUiStore.getState().say('The museum is ready to open without a connection.', 6000, { quiet: true });
    },
  });
}
