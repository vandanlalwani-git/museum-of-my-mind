/** Small drawn marks that carry meaning: a star's light, a planet's progress ring. */
import type { Progress } from '@/mind/shapes';
import type { GalaxyHue, ProjectShapeKind } from '@/mind/types';

export const hueVar = (h: GalaxyHue) => `var(--hue-${h})`;

/** A goal's star: brighter when it has moved recently. */
export function StarGlyph({ brightness = 1, size = 22 }: { brightness?: number; size?: number }) {
  const b = Math.max(0.35, Math.min(1, brightness));
  return (
    <svg className="glyph-star" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r={7 + b * 3} fill="var(--star-halo)" opacity={0.08 + b * 0.16} />
      <rect x="1" y="11.6" width="22" height="0.8" fill="var(--star-halo)" opacity={0.18 + b * 0.25} />
      <circle cx="12" cy="12" r={2.2 + b * 1.4} fill="var(--star-core)" opacity={0.55 + b * 0.45} />
    </svg>
  );
}

const lightOf = (shape: ProjectShapeKind) => (shape === 'habit' ? 'var(--verdigris)' : shape === 'explore' ? 'var(--question)' : 'var(--gold)');

/** A planet with its ring of light. Progress is shown as light, not numbers. */
export function PlanetGlyph({ progress, shape, size = 40 }: { progress: Pick<Progress, 'fraction'>; shape: ProjectShapeKind; size?: number }) {
  const c = size / 2, r = size * 0.36, circ = 2 * Math.PI * r, f = Math.max(0, Math.min(1, progress.fraction));
  const light = lightOf(shape);
  return (
    <svg className="glyph-planet" width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle cx={c} cy={c} r={size * 0.22} fill={light} opacity={0.05 + f * 0.25} style={{ filter: `blur(${size * 0.08}px)` }} />
      <circle cx={c} cy={c} r={r} fill="none" stroke="var(--hairline-soft)" strokeWidth={size > 60 ? 2 : 1} />
      {f > 0 && <circle cx={c} cy={c} r={r} fill="none" stroke={light} strokeWidth={size > 60 ? 3 : 1.5} strokeLinecap="round" strokeDasharray={`${(f * circ).toFixed(1)} ${circ.toFixed(1)}`} transform={`rotate(-90 ${c} ${c})`} />}
      <circle cx={c} cy={c} r={size * 0.13} fill="var(--parchment-dim)" />
    </svg>
  );
}

/** A thought: a small point of light; an open question flickers. */
export function ThoughtGlyph({ question = false }: { question?: boolean }) {
  return <span className={`glyph-thought ${question ? 'glyph-thought--q' : ''}`} aria-hidden="true" />;
}
