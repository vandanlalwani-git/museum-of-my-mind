import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@/app/App';
import { setupPWA } from '@/app/pwa';
import '@/styles/base.css';

// Dev-only test hook: `?forceframes=1` drives animation frames from a timer so a
// hidden tab (headless inspection) still renders. Never active in production builds.
if (import.meta.env.DEV && new URLSearchParams(location.search).has('forceframes')) {
  window.requestAnimationFrame = (cb) => window.setTimeout(() => cb(performance.now()), 33) as unknown as number;
  window.cancelAnimationFrame = (id) => window.clearTimeout(id);
  // Hidden documents never deliver ResizeObserver callbacks; poll instead.
  class PollingResizeObserver {
    private els = new Map<Element, string>();
    private timer: number;
    constructor(private cb: (entries: ResizeObserverEntry[], o: ResizeObserver) => void) {
      this.timer = window.setInterval(() => this.check(), 250);
    }
    observe(el: Element) { this.els.set(el, ''); this.check(); }
    unobserve(el: Element) { this.els.delete(el); }
    disconnect() { window.clearInterval(this.timer); this.els.clear(); }
    private check() {
      const entries: ResizeObserverEntry[] = [];
      for (const [el, prev] of this.els) {
        const r = el.getBoundingClientRect();
        const key = `${r.width}x${r.height}`;
        if (key !== prev) {
          this.els.set(el, key);
          const box = { inlineSize: r.width, blockSize: r.height };
          entries.push({ target: el, contentRect: r, borderBoxSize: [box], contentBoxSize: [box], devicePixelContentBoxSize: [box] } as unknown as ResizeObserverEntry);
        }
      }
      if (entries.length) this.cb(entries, this as unknown as ResizeObserver);
    }
  }
  window.ResizeObserver = PollingResizeObserver as unknown as typeof ResizeObserver;
}

setupPWA();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
