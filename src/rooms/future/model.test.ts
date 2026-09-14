import { describe, expect, it } from 'vitest';
import { demoRecords } from '@/data/seed/demo';
import { explain, simulate } from './model';

const goal = demoRecords.goals.find((g) => g.id === 'g-side-project')!;
const base = { hoursPerWeek: 4, consistency: 0.7, focus: 0.85, rest: 0.6 };

describe('future model', () => {
  it('is deterministic', () => {
    const a = simulate(goal, demoRecords.projects, demoRecords.actions, base);
    const b = simulate(goal, demoRecords.projects, demoRecords.actions, base);
    expect(a).toEqual(b);
  });

  it('never goes backwards or above done, and ignores finished and set-aside projects', () => {
    const o = simulate(goal, demoRecords.projects, demoRecords.actions, base);
    for (const p of o.projects) {
      for (let i = 1; i < p.path.length; i++) expect(p.path[i]).toBeGreaterThanOrEqual(p.path[i - 1]!);
      expect(Math.max(...p.path)).toBeLessThanOrEqual(1);
    }
    expect(o.projects.map((p) => p.projectId)).not.toContain('p-podcast');
  });

  it('more consistency brightens the goal and finishes sooner', () => {
    const low = simulate(goal, demoRecords.projects, demoRecords.actions, { ...base, consistency: 0.2 });
    const high = simulate(goal, demoRecords.projects, demoRecords.actions, { ...base, consistency: 1 });
    expect(high.brightness[2]).toBeGreaterThan(low.brightness[2]);
    const lf = low.projects[0]!.finishMonth ?? 99, hf = high.projects[0]!.finishMonth ?? 99;
    expect(hf).toBeLessThanOrEqual(lf);
  });

  it('scattering attention moves more projects but each more slowly', () => {
    const one = simulate(goal, demoRecords.projects, demoRecords.actions, { ...base, focus: 1 });
    const all = simulate(goal, demoRecords.projects, demoRecords.actions, { ...base, focus: 0 });
    expect(one.workedCount).toBe(1);
    expect(all.workedCount).toBe(one.candidateCount);
    expect(all.switchingTax).toBeGreaterThan(0);
    const first = one.projects[0]!.projectId;
    const oneP = one.projects.find((p) => p.projectId === first)!, allP = all.projects.find((p) => p.projectId === first)!;
    expect(oneP.path[3]).toBeGreaterThan(allP.path[3]!);
    expect(oneP.finishMonth ?? 99).toBeLessThanOrEqual(allP.finishMonth ?? 99);
  });

  it('thin rest fades the pace over the year', () => {
    const rested = simulate(goal, demoRecords.projects, demoRecords.actions, { ...base, rest: 0.8 });
    const tired = simulate(goal, demoRecords.projects, demoRecords.actions, { ...base, rest: 0.1 });
    expect(tired.sustain[2]).toBeLessThan(rested.sustain[2]);
    expect(tired.sustain[0]).toBeGreaterThan(tired.sustain[2]);
  });

  it('explains in plain sentences and clamps wild controls', () => {
    const o = simulate(goal, demoRecords.projects, demoRecords.actions, { hoursPerWeek: 999, consistency: -3, focus: 7, rest: NaN });
    expect(o.controls).toEqual({ hoursPerWeek: 20, consistency: 0, focus: 1, rest: 0, projectHours: 40 });
    const lines = explain(o, goal);
    expect(lines.length).toBeGreaterThan(2);
    expect(lines.join(' ')).not.toMatch(/undefined|NaN/);
  });
});

describe('project size', () => {
  it('a larger size takes longer, and a per-project size overrides the typical one', () => {
    const medium = simulate(goal, demoRecords.projects, demoRecords.actions, { ...base, projectHours: 40 });
    const large = simulate(goal, demoRecords.projects, demoRecords.actions, { ...base, projectHours: 100 });
    expect(large.projects[0]!.path[3]).toBeLessThan(medium.projects[0]!.path[3]!);
    const sized = demoRecords.projects.map((p) => (p.id === 'p-budget-app' ? { ...p, sizeHours: 15 } : p));
    const small = simulate(goal, sized, demoRecords.actions, { ...base, projectHours: 100 });
    const budget = small.projects.find((p) => p.projectId === 'p-budget-app')!;
    expect(budget.sizeSet).toBe(true);
    expect(budget.finishMonth ?? 99).toBeLessThanOrEqual(large.projects.find((p) => p.projectId === 'p-budget-app')!.finishMonth ?? 99);
    expect(explain(small, goal).join(' ')).toMatch(/is small/);
  });
});
