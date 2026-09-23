import { afterEach, describe, expect, it, vi } from 'vitest';
import { MAX_DPR, PIXEL_BUDGET, applySurface, measureSurface, stableDpr, surfaceChanged } from './surface';

function fakeEl(width: number, height: number): HTMLElement {
  return { getBoundingClientRect: () => ({ width, height }) } as unknown as HTMLElement;
}
function setViewport(dpr: number, scale = 1) {
  vi.stubGlobal('window', { devicePixelRatio: dpr, visualViewport: { scale } });
}
afterEach(() => vi.unstubAllGlobals());

describe('stableDpr', () => {
  it('clamps to the maximum and never goes below 1', () => {
    setViewport(4); expect(stableDpr()).toBe(MAX_DPR);
    setViewport(0.5); expect(stableDpr()).toBe(1);
  });

  it('divides out pinch zoom so zooming does not grow the buffer', () => {
    setViewport(2, 1); const normal = stableDpr();
    setViewport(6, 3); const zoomed = stableDpr(); // iOS reports dpr * scale
    expect(zoomed).toBe(normal);
  });
});

describe('measureSurface', () => {
  it('never exceeds the pixel budget, however large the element', () => {
    setViewport(2);
    for (const [w, h] of [[400, 800], [1440, 900], [3840, 2160], [8000, 5000]]) {
      const s = measureSurface(fakeEl(w!, h!));
      expect(s.bufferWidth * s.bufferHeight).toBeLessThanOrEqual(PIXEL_BUDGET + 4096);
      expect(s.bufferWidth).toBeGreaterThan(0);
      expect(s.bufferHeight).toBeGreaterThan(0);
    }
  });

  it('keeps a phone-sized surface at full ratio', () => {
    setViewport(3);
    const s = measureSurface(fakeEl(390, 700));
    expect(s.dpr).toBe(MAX_DPR);
    expect(s.bufferWidth).toBe(780);
  });

  it('produces the same buffer zoomed in as at rest', () => {
    setViewport(3, 1); const rest = measureSurface(fakeEl(390, 700));
    setViewport(9, 3); const zoomed = measureSurface(fakeEl(390, 700));
    expect(zoomed.bufferWidth).toBe(rest.bufferWidth);
    expect(zoomed.bufferHeight).toBe(rest.bufferHeight);
  });

  it('survives a zero-sized element', () => {
    setViewport(2);
    const s = measureSurface(fakeEl(0, 0));
    expect(s.bufferWidth).toBeGreaterThanOrEqual(1);
  });
});

describe('applySurface', () => {
  it('reallocates only when the buffer really changes', () => {
    setViewport(2);
    const canvas = { width: 0, height: 0 } as HTMLCanvasElement;
    const s = measureSurface(fakeEl(200, 100));
    expect(applySurface(canvas, s)).toBe(true);
    expect(surfaceChanged(canvas, s)).toBe(false);
    expect(applySurface(canvas, s)).toBe(false); // second call is a no-op
  });
});
