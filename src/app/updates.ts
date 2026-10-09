import { lazy, type ComponentType } from 'react';

/**
 * Keeping an open page working across a deploy.
 *
 * Each deploy replaces the room files with newly named ones. A page that was
 * opened before the deploy still asks for the old names; the server no longer
 * has them, so opening a room fails ("Failed to fetch dynamically imported
 * module", or "Importing a module script failed" on Safari and iOS). That is
 * the crash a visitor saw right after creating a museum.
 *
 * The cure is to reload once, which fetches the new version. A short guard in
 * sessionStorage stops a reload loop if something else is genuinely wrong.
 */

const RELOAD_KEY = 'museum:update-reload-at';
const LOOP_GUARD_MS = 30_000;

const CHUNK_ERRORS = [
  /Failed to fetch dynamically imported module/i, // Chromium
  /error loading dynamically imported module/i, // Firefox
  /Importing a module script failed/i, // Safari, iOS
  /Unable to preload CSS/i, // Vite's stylesheet preload
  /ChunkLoadError/i,
];

export function isChunkLoadError(err: unknown): boolean {
  const text = err instanceof Error ? `${err.name}: ${err.message}` : String(err ?? '');
  return CHUNK_ERRORS.some((p) => p.test(text));
}

/** Pure: may we reload now, given when we last reloaded for an update? */
export function mayReload(lastAt: number | null, now: number, guardMs = LOOP_GUARD_MS): boolean {
  return lastAt === null || !Number.isFinite(lastAt) || now - lastAt > guardMs;
}

function lastReloadAt(): number | null {
  try { const v = sessionStorage.getItem(RELOAD_KEY); return v ? Number(v) : null; } catch { return null; }
}

/** Reload once to pick up the new version. False if we already tried moments ago. */
export function reloadForUpdate(now = Date.now()): boolean {
  if (!mayReload(lastReloadAt(), now)) return false;
  try { sessionStorage.setItem(RELOAD_KEY, String(now)); } catch { /* private mode: reload anyway */ }
  window.location.reload();
  return true;
}

/**
 * Load a room, and if its file vanished in a deploy, reload instead of
 * crashing. While the reload is under way the promise never settles, so no
 * error flashes on screen.
 */
export async function loadWithRecovery<T>(factory: () => Promise<T>, reload: () => boolean = reloadForUpdate): Promise<T> {
  try {
    return await factory();
  } catch (err) {
    if (isChunkLoadError(err) && reload()) return new Promise<T>(() => {});
    throw err;
  }
}

/** React.lazy that survives a deploy. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyRoom<T extends ComponentType<any>>(factory: () => Promise<{ default: T }>) {
  return lazy(() => loadWithRecovery(factory));
}

/* ---------- applying a service-worker update at a safe moment ---------- */

/**
 * True while someone has words in a text field that are not saved yet. An
 * update must never wipe them; it waits for the next quiet moment instead.
 */
export function hasTypingInProgress(doc: Pick<Document, 'querySelectorAll'> = document): boolean {
  const fields = doc.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
    'textarea, input:not([type]), input[type=text], input[type=url], input[type=email], input[type=password]',
  );
  return Array.from(fields).some((f) => !f.disabled && f.value.trim().length > 0);
}

let updatePending = false;

/** Called when a new version has taken over. Reloads only when nothing would be lost. */
export function markUpdatePending(): void {
  updatePending = true;
  if (document.visibilityState === 'hidden' && !hasTypingInProgress()) reloadForUpdate();
}

/** Called on in-app navigation: a natural moment to switch to the new version. */
export function reloadIfUpdatePending(): boolean {
  if (!updatePending || hasTypingInProgress()) return false;
  return reloadForUpdate();
}

export function installSafeUpdateMoments(): void {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') reloadIfUpdatePending();
  });
}
