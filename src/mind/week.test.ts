import { describe, expect, it } from 'vitest';
import { addDays, dayKey, startOfWeek } from './calendar';
import { buildDemoSnapshot } from './demo';
import { onThisDay, weekSummary } from './week';

const SUN = new Date(2026, 9, 11, 18).getTime();

describe('the weekly review', () => {
  it('finds what moved this week, with before and after counts for number projects', () => {
    const s = buildDemoSnapshot(SUN);
    const w = weekSummary(s, dayKey(startOfWeek(SUN)), SUN);
    expect(w.moved.length).toBeGreaterThan(0);
    const runs = w.moved.find((m) => m.project.id === 'd-p-5k');
    expect(runs?.ticks).toBe(3);
    const users = w.moved.find((m) => m.project.id === 'd-p-users');
    expect(users?.count).toEqual({ from: 3, to: 4, target: 10 });
    expect(w.openQuestions).toBeGreaterThan(0);
  });

  it('a goal is quiet only if nothing under it moved for more than ten days', () => {
    const s = buildDemoSnapshot(SUN);
    const w = weekSummary(s, dayKey(startOfWeek(SUN)), SUN);
    for (const g of w.quiet) expect(w.moved.some((m) => m.goal?.id === g.id)).toBe(false);
  });

  it('On this day finds entries from a month and a year ago', () => {
    const s = buildDemoSnapshot(SUN);
    const monthAgo = new Date(2026, 8, 11, 20).getTime();
    s.journal.push({ ...s.journal[0]!, id: 'x', date: dayKey(monthAgo), at: monthAgo, title: 'Signed up for the trial class' });
    expect(onThisDay(s, SUN).map((r) => [r.entry.title, r.ago])).toEqual([['Signed up for the trial class', 'A month ago']]);
    expect(onThisDay(s, addDays(new Date(SUN), 1).getTime())).toEqual([]);
  });
});
