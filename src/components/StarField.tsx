import { useEffect, useRef } from 'react';
import { hashString, mulberry32 } from '@/lib/rng';
import { prefersReducedMotion } from '@/lib/motion';

interface Props {
  seed?: string;
  density?: number; // stars per 10k px^2
  className?: string;
}

interface Star { x: number; y: number; r: number; a: number; tw: number; ph: number }

/**
 * Deterministic ambient star field on canvas. Drift is very slow; twinkle is
 * subtle; both stop under reduced motion. Coordinates are normalised so the
 * same seed renders the same sky at any size.
 */
export function StarField({ seed = 'entrance', density = 0.9, className }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let stars: Star[] = [];
    let w = 0, h = 0, dpr = 1;
    let raf = 0;
    const reduced = prefersReducedMotion();
    const t0 = performance.now();

    const build = () => {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = rect.width; h = rect.height;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const rng = mulberry32(hashString(seed));
      const n = Math.floor((w * h) / 10_000 * density);
      stars = Array.from({ length: n }, () => {
        const mag = rng();
        return {
          x: rng(), y: rng(),
          r: mag < 0.85 ? 0.5 + rng() * 0.6 : 1 + rng() * 1.2,
          a: 0.25 + rng() * 0.6,
          tw: 0.6 + rng() * 1.8,
          ph: rng() * Math.PI * 2,
        };
      });
    };

    const draw = (now: number) => {
      const t = (now - t0) / 1000;
      ctx.clearRect(0, 0, w, h);
      const drift = reduced ? 0 : t * 0.0008; // normalised units per second
      for (const s of stars) {
        const x = ((s.x + drift) % 1) * w;
        const y = s.y * h;
        const twinkle = reduced ? 1 : 0.8 + 0.2 * Math.sin(t * s.tw + s.ph);
        ctx.globalAlpha = s.a * twinkle;
        ctx.fillStyle = s.r > 1 ? '#e8dcc4' : '#c9c0ad';
        ctx.beginPath();
        ctx.arc(x, y, s.r, 0, Math.PI * 2);
        ctx.fill();
        if (s.r > 1.6) {
          ctx.globalAlpha = s.a * twinkle * 0.25;
          ctx.fillStyle = '#c9a961';
          ctx.beginPath();
          ctx.arc(x, y, s.r * 2.4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
      if (!reduced) raf = requestAnimationFrame(draw);
    };

    build();
    draw(performance.now());
    const ro = new ResizeObserver(() => { build(); if (reduced) draw(performance.now()); });
    ro.observe(canvas);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, [seed, density]);

  return <canvas ref={ref} className={className} aria-hidden="true" />;
}
