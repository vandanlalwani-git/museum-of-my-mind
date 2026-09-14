import { describe, expect, it } from 'vitest';
import { pickUps } from './pickup';
import { demoRecords } from '@/data/seed/demo';
import { emptyRecords } from '@/types';

const NOW = Date.UTC(2026, 8, 1, 9, 0, 0); // the seed's base date

describe('pickUps', () => {
  it('is deterministic and explains every choice', () => {
    const a = pickUps(demoRecords, NOW);
    const b = pickUps(demoRecords, NOW);
    expect(a.map((p) => p.project.id)).toEqual(b.map((p) => p.project.id));
    expect(a.length).toBeGreaterThan(0);
    for (const p of a) expect(p.reasons.length).toBeGreaterThan(0);
  });

  it('never suggests finished, set-aside, or freshly touched projects', () => {
    const ids = pickUps(demoRecords, NOW, 20).map((p) => p.project.id);
    expect(ids).not.toContain('p-birthdays');   // done
    expect(ids).not.toContain('p-podcast');     // abandoned
    expect(ids).not.toContain('p-budget-app');  // touched yesterday
  });

  it('prefers a resting project with a next step over a bare idea', () => {
    const picks = pickUps(demoRecords, NOW);
    expect(picks[0]?.project.id).toBe('p-photo-walks');
    expect(picks[0]?.reasons.join(' ')).toMatch(/next step/);
  });

  it('returns nothing for an empty museum', () => {
    expect(pickUps(emptyRecords(), NOW)).toEqual([]);
  });
});
