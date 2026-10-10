import { describe, expect, it } from 'vitest';
import { addDays, dayKey, startOfWeek } from './calendar';
import { buildDemoSnapshot } from './demo';
import { focusGoalIds, nextStepFor, planToday, reviewWeekFor, thoughtOfTheDay } from './today';

const SAT = new Date(2026, 9, 10, 9).getTime(); // Saturday 10 October 2026
const SUN = new Date(2026, 9, 11, 9).getTime();

describe('Today', () => {
  it('stays small: one thought, at most two focus goals, one step each', () => {
    const s = buildDemoSnapshot(SAT);
    const plan = planToday(s, SAT);
    expect(plan.focus.length).toBeLessThanOrEqual(2);
    for (const f of plan.focus) expect(f.step === null || typeof f.step.text === 'string').toBe(true);
    expect(plan.unsortedCount).toBeGreaterThan(0);
  });

  it('uses last week’s chosen focus until this week has its own', () => {
    const s = buildDemoSnapshot(SAT);
    expect(focusGoalIds(s, SAT)).toEqual({ ids: ['d-g-app', 'd-g-strong'], source: 'last-week' });
    s.reviews.push({ ...s.reviews[0]!, id: 'now', weekStart: dayKey(startOfWeek(SAT)), focusGoalIds: ['d-g-make'] });
    expect(focusGoalIds(s, SAT)).toEqual({ ids: ['d-g-make'], source: 'chosen' });
  });

  it('offers a due repeating step before a one-off, and never a waiting or someday step', () => {
    const s = buildDemoSnapshot(SAT);
    const app = s.goals.find((g) => g.id === 'd-g-app')!;
    const pick = nextStepFor(s, app, SAT);
    expect(pick.step && ['once', 'repeat', 'session']).toContain(pick.step!.kind);
    expect(['waiting', 'someday']).not.toContain(pick.step!.kind);
    const make = s.goals.find((g) => g.id === 'd-g-make')!;
    expect(nextStepFor(s, make, SAT).step?.text).toBe('Go on a photo walk'); // due on Saturdays
  });

  it('the thought of the day prefers an open question and is stable within a day', () => {
    const s = buildDemoSnapshot(SAT);
    const a = thoughtOfTheDay(s, SAT), b = thoughtOfTheDay(s, SAT + 3600_000);
    expect(a?.reason).toBe('question');
    expect(a?.t.id).toBe(b?.t.id);
  });

  it('the weekly review waits on Sunday and Monday only, until it is closed', () => {
    const s = buildDemoSnapshot(SUN);
    expect(reviewWeekFor(s, SAT)).toBeNull();
    expect(reviewWeekFor(s, SUN)).toBe(dayKey(startOfWeek(SUN)));
    expect(reviewWeekFor(s, addDays(new Date(SUN), 1).getTime())).toBe(dayKey(startOfWeek(SUN)));
  });
});
