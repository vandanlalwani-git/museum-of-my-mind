import { describe, expect, it } from 'vitest';
import { demoRecords } from '@/data/seed/demo';
import { emptyRecords } from '@/types';
import { focusProgress, focusChoices, forgottenOne, nextStepFor, openStepsFor, projectsNeedingAStep, resolveFocus } from './selection';

const NOW = Date.UTC(2026, 8, 1, 9, 0, 0);
const DAY = 86_400_000;

describe('resolveFocus', () => {
  it('honours a pinned goal that is still in the sky', () => {
    const f = resolveFocus(demoRecords, 'g-creativity');
    expect(f.goal?.id).toBe('g-creativity');
    expect(f.fellBack).toBe(false);
  });

  it('falls back to a goal that has a next step when the pin is gone', () => {
    const f = resolveFocus(demoRecords, 'g-deleted');
    expect(f.goal).not.toBeNull();
    expect(f.fellBack).toBe(true);
    expect(nextStepFor(demoRecords, f.goal!.id)).not.toBeNull();
  });

  it('offers only live goals as choices, active before resting', () => {
    const records = { ...demoRecords, goals: demoRecords.goals.map((g) => (g.id === 'g-people' ? { ...g, state: 'fulfilled' as const } : g)) };
    const ids = focusChoices(records).map((g) => g.id);
    expect(ids).not.toContain('g-people');
    expect(ids.length).toBeGreaterThan(0);
  });

  it('returns nothing for an empty museum without crashing', () => {
    const f = resolveFocus(emptyRecords(), null);
    expect(f.goal).toBeNull();
    expect(f.choices).toEqual([]);
  });
});

describe('nextStepFor', () => {
  it('picks one step and keeps the rest as alternatives', () => {
    const step = nextStepFor(demoRecords, 'g-side-project');
    expect(step?.action.text).toBe('Add the category dropdown');
    expect(step?.project.id).toBe('p-budget-app');
    expect(step!.alternatives.length).toBeGreaterThan(0);
    expect(step!.alternatives.map((a) => a.action.id)).not.toContain(step!.action.id);
  });

  it('never offers a done step, and skips one snoozed until later', () => {
    const goalId = 'g-side-project';
    const first = nextStepFor(demoRecords, goalId)!;
    const snoozed = { ...demoRecords, actions: demoRecords.actions.map((a) => (a.id === first.action.id ? { ...a, restUntil: NOW + DAY } : a)) };
    const after = nextStepFor(snoozed, goalId, NOW)!;
    expect(after.action.id).not.toBe(first.action.id);
    const allDone = { ...demoRecords, actions: demoRecords.actions.map((a) => ({ ...a, doneAt: NOW })) };
    expect(nextStepFor(allDone, goalId, NOW)).toBeNull();
  });

  it('a snoozed step returns once its rest has passed', () => {
    const goalId = 'g-side-project';
    const first = nextStepFor(demoRecords, goalId)!;
    const snoozed = { ...demoRecords, actions: demoRecords.actions.map((a) => (a.id === first.action.id ? { ...a, restUntil: NOW + DAY } : a)) };
    expect(nextStepFor(snoozed, goalId, NOW + 2 * DAY)!.action.id).toBe(first.action.id);
  });

  it('orders steps by project liveliness', () => {
    const steps = openStepsFor(demoRecords, 'g-health', NOW);
    expect(steps[0]?.project.status).toBe('active');
  });
});

describe('the rest of the screen', () => {
  it('names projects that have no next step, so Today can offer to add one', () => {
    const bare = projectsNeedingAStep(demoRecords, 'g-side-project', NOW);
    expect(bare.map((p) => p.id)).toContain('p-one-page-site');
  });

  it('surfaces one forgotten thing with a reason, and respects skips', () => {
    const one = forgottenOne(demoRecords, NOW, 'demo');
    expect(one).not.toBeNull();
    expect(one!.reasons.length).toBeGreaterThan(0);
    const next = forgottenOne(demoRecords, NOW, 'demo', new Set([one!.id]));
    expect(next?.id).not.toBe(one!.id);
    expect(forgottenOne(emptyRecords(), NOW, 'x')).toBeNull();
  });

  it('counts progress for the focus goal', () => {
    const p = focusProgress(demoRecords, 'g-side-project');
    expect(p.total).toBeGreaterThan(0);
    expect(p.done).toBeLessThanOrEqual(p.total);
    expect(p.projects).toBeGreaterThan(0);
  });
});
