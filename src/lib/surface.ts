/**
 * Canvas sizing that cannot crash a phone.
 *
 * Three things went wrong before this existed:
 *  - `canvas.width = n` reallocates the backing store even when `n` is
 *    unchanged, and the old code reassigned on every ResizeObserver fire.
 *  - On iOS, pinch-zoom and the URL bar collapsing both change `100dvh`, so
 *    the observer fires many times during a single gesture.
 *  - The buffer was sized `rect x devicePixelRatio` with no ceiling, so zoom
 *    inflated it until Safari killed the tab.
 *
 * `measureSurface` clamps the pixel budget absolutely, divides out any pinch
 * zoom, and reports whether anything actually changed so callers can skip the
 * reallocation entirely.
 */

/** Hard ceiling on backing-store pixels for one canvas (~2.1M = 1920x1080). */
export const PIXEL_BUDGET = 2_100_000;
export const MAX_DPR = 2;

export interface Surface {
  /** CSS pixels. */
  width: number;
  height: number;
  /** Device-pixel ratio actually used, after clamping to the budget. */
  dpr: number;
  /** Backing-store pixels. */
  bufferWidth: number;
  bufferHeight: number;
}

/**
 * The zoom-independent device pixel ratio. iOS multiplies
 * `devicePixelRatio` by the pinch-zoom scale; dividing it back out keeps the
 * buffer the same size whether the visitor is zoomed in or not.
 */
export function stableDpr(): number {
  if (typeof window === 'undefined') return 1;
  const raw = window.devicePixelRatio || 1;
  const zoom = window.visualViewport?.scale ?? 1;
  const unzoomed = zoom > 0 ? raw / zoom : raw;
  return Math.max(1, Math.min(MAX_DPR, unzoomed));
}

export function measureSurface(el: HTMLElement): Surface {
  const rect = el.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width));
  const height = Math.max(1, Math.round(rect.height));
  let dpr = stableDpr();
  // Shrink the ratio until the buffer fits the budget. A large desktop window
  // simply renders at a lower ratio rather than allocating without limit.
  // The budget is absolute: it wins over the preferred ratio, with no floor,
  // because breaching it is what crashed the tab.
  const area = width * height;
  if (area * dpr * dpr > PIXEL_BUDGET) dpr = Math.sqrt(PIXEL_BUDGET / area);
  return { width, height, dpr, bufferWidth: Math.floor(width * dpr), bufferHeight: Math.floor(height * dpr) };
}

/** True when the backing store would genuinely change size. */
export function surfaceChanged(canvas: HTMLCanvasElement, s: Surface): boolean {
  return canvas.width !== s.bufferWidth || canvas.height !== s.bufferHeight;
}

/**
 * Apply a surface to a canvas, reallocating only when the buffer size really
 * changed. Returns true if a reallocation happened.
 */
export function applySurface(canvas: HTMLCanvasElement, s: Surface): boolean {
  if (!surfaceChanged(canvas, s)) return false;
  canvas.width = s.bufferWidth;
  canvas.height = s.bufferHeight;
  return true;
}

/**
 * Observe an element for size changes, coalescing bursts into one callback per
 * animation frame and ignoring changes that would not alter the buffer.
 * Also listens to visual-viewport zoom so a pinch settles to a single call.
 */
export function observeSurface(el: HTMLElement, onChange: (s: Surface) => void): () => void {
  let frame = 0;
  let last = '';
  const run = () => {
    frame = 0;
    const s = measureSurface(el);
    const key = `${s.bufferWidth}x${s.bufferHeight}`;
    if (key === last) return;
    last = key;
    onChange(s);
  };
  const schedule = () => {
    if (frame) return;
    frame = requestAnimationFrame(run);
  };
  const ro = new ResizeObserver(schedule);
  ro.observe(el);
  const vv = window.visualViewport;
  vv?.addEventListener('resize', schedule);
  schedule();
  return () => {
    if (frame) cancelAnimationFrame(frame);
    ro.disconnect();
    vv?.removeEventListener('resize', schedule);
  };
}
