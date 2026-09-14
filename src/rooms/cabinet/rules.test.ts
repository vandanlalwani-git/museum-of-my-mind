import { describe, expect, it } from 'vitest';
import { curiosities } from './rules';
import { demoRecords } from '@/data/seed/demo';
import { emptyRecords } from '@/types';

const NOW = Date.UTC(2026, 8, 1, 9, 0, 0);
const DAY = 86_400_000;

describe('cabinet rules', () => {
  it('is deterministic for a day and varies across days', () => {
    const a = curiosities(demoRecords, NOW, { seed: 'demo' });
    const b = curiosities(demoRecords, NOW, { seed: 'demo' });
    expect(a.map((c) => c.id)).toEqual(b.map((c) => c.id));
    const days = new Set<string>();
    for (let d = 0; d < 6; d++) days.add(curiosities(demoRecords, NOW + d * DAY, { seed: 'demo' }).map((c) => c.id).join(','));
    expect(days.size).toBeGreaterThan(1);
  });

  it('explains every choice and never shows fresh, archived, finished, or resting items', () => {
    const rec = {
      ...demoRecords,
      notes: demoRecords.notes.map((n) => (n.id === 'n-5' ? { ...n, archivedAt: 1 } : n.id === 'n-1' ? { ...n, restUntil: NOW + DAY } : n)),
    };
    const picks = curiosities(rec, NOW, { seed: 'demo', limit: 20 });
    for (const c of picks) expect(c.reasons.length).toBeGreaterThan(0);
    const ids = picks.map((c) => c.id);
    expect(ids).not.toContain('n-5');        // archived
    expect(ids).not.toContain('n-1');        // resting until tomorrow
    expect(ids).not.toContain('m-3');        // touched this week
    expect(ids).not.toContain('p-birthdays');// done
    expect(ids).not.toContain('p-podcast');  // set aside
    expect(ids).not.toContain('p-budget-app');// active projects are the Workshop's business
  });

  it('recognises an anniversary and an unfinished project', () => {
    const picks = curiosities(demoRecords, NOW, { seed: 'demo', limit: 20 });
    const jo = picks.find((c) => c.id === 'm-5');
    expect(jo?.reasons.join(' ')).toMatch(/this time of year/);
    const walks = picks.find((c) => c.id === 'p-photo-walks');
    expect(walks?.reasons.join(' ')).toMatch(/never finished/);
  });

  it('honours the session exclude list and empties gracefully', () => {
    const first = curiosities(demoRecords, NOW, { seed: 'demo' });
    const again = curiosities(demoRecords, NOW, { seed: 'demo', exclude: new Set(first.map((c) => c.id)) });
    expect(again.map((c) => c.id).some((id) => first.some((c) => c.id === id))).toBe(false);
    expect(curiosities(emptyRecords(), NOW)).toEqual([]);
  });
});
