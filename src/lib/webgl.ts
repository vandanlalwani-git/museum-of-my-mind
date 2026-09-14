/** Can this browser draw the dome? Cheap probe; result cached per session. */
let cached: boolean | null = null;

export function webglAvailable(): boolean {
  if (cached !== null) return cached;
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') ?? c.getContext('webgl');
    cached = !!gl;
    const lose = (gl as WebGLRenderingContext | null)?.getExtension('WEBGL_lose_context');
    lose?.loseContext();
  } catch {
    cached = false;
  }
  return cached;
}

/** A conservative guess at devices that would rather not run WebGL. */
export function lowPowerDevice(): boolean {
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  if (nav.connection?.saveData) return true;
  if (typeof nav.deviceMemory === 'number' && nav.deviceMemory <= 2) return true;
  if (typeof nav.hardwareConcurrency === 'number' && nav.hardwareConcurrency <= 2) return true;
  return false;
}

const KEY = 'museum:dome';

export function domeDisabledBySession(): boolean {
  try { return sessionStorage.getItem(KEY) === 'off'; } catch { return false; }
}
export function disableDomeForSession(): void {
  try { sessionStorage.setItem(KEY, 'off'); } catch { /* ignore */ }
}
