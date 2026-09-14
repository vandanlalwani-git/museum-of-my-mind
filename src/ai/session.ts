/**
 * The API key lives here and nowhere else: a module variable, for this tab,
 * until the tab is refreshed or closed, or the keeper forgets it on purpose.
 * It is never written to storage, the URL, logs, or backups.
 */
let key: string | null = null;
const listeners = new Set<() => void>();

export function setSessionKey(k: string) { key = k.trim(); notify(); }
export function clearSessionKey() { key = null; notify(); }
export function hasSessionKey(): boolean { return key !== null && key.length > 0; }
/** Read the key for one request. Not exported to the window. */
export function takeSessionKey(): string | null { return key; }
export function onSessionKeyChange(fn: () => void): () => void { listeners.add(fn); return () => listeners.delete(fn); }
function notify() { for (const fn of listeners) fn(); }

export function looksLikeAnthropicKey(k: string): boolean { return /^sk-ant-[A-Za-z0-9_-]{20,}$/.test(k.trim()); }
