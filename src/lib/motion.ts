export const EASE_OUT_QUINT = [0.22, 1, 0.36, 1] as const;

/** System preference only. */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Effective motion setting: the keeper's choice in settings wins over the
 * system preference. 'on' forces reduced motion, 'off' forces full motion.
 */
export function motionReduced(): boolean {
  if (typeof document === 'undefined') return false;
  const choice = document.documentElement.dataset.reduceMotion;
  if (choice === 'on') return true;
  if (choice === 'off') return false;
  return prefersReducedMotion();
}
