import { describe, expect, it } from 'vitest';
import { layoutSky, nextForGoal } from './layout';
import { demoRecords } from '@/data/seed/demo';

describe('layoutSky', () => {
  it('is deterministic and keeps every node on the surface', () => {
    const a = layoutSky(demoRecords.goals, demoRecords.projects);
    const b = layoutSky(demoRecords.goals, demoRecords.projects);
    expect(JSON.stringify([...a.byId.entries()])).toBe(JSON.stringify([...b.byId.entries()]));
    for (const g of a.goals) {
      expect(g.x).toBeGreaterThan(0); expect(g.x).toBeLessThan(1);
      expect(g.y).toBeGreaterThan(0); expect(g.y).toBeLessThan(1);
    }
  });

  it('excludes fulfilled and released goals and abandoned projects', () => {
    const goals = demoRecords.goals.map((g, i) => (i === 0 ? { ...g, state: 'released' as const } : g));
    const l = layoutSky(goals, demoRecords.projects);
    expect(l.goals.map((g) => g.id)).not.toContain(goals[0]!.id);
    expect(l.projects.map((p) => p.id)).not.toContain('p-podcast');
  });

  it('places projects of a released goal adrift rather than dropping them', () => {
    const goals = demoRecords.goals.map((g) => (g.id === 'g-creativity' ? { ...g, state: 'fulfilled' as const } : g));
    const l = layoutSky(goals, demoRecords.projects);
    const walks = l.projects.find((p) => p.id === 'p-photo-walks');
    expect(walks?.goalId).toBeNull();
  });

  it('spreads goals apart', () => {
    const l = layoutSky(demoRecords.goals, demoRecords.projects);
    for (let i = 0; i < l.goals.length; i++) {
      for (let j = i + 1; j < l.goals.length; j++) {
        const dx = l.goals[i]!.x - l.goals[j]!.x, dy = l.goals[i]!.y - l.goals[j]!.y;
        expect(Math.hypot(dx, dy)).toBeGreaterThan(0.12);
      }
    }
  });
});

describe('nextForGoal', () => {
  it('finds the oldest open action of the freshest active project', () => {
    const next = nextForGoal('g-side-project', demoRecords.projects, demoRecords.actions);
    expect(next?.project.id).toBe('p-budget-app');
    expect(next?.action.text).toBe('Add the category dropdown');
  });
  it('returns null when nothing is open', () => {
    expect(nextForGoal('g-people', demoRecords.projects, demoRecords.actions.map((a) => ({ ...a, doneAt: 1 })))).toBeNull();
  });
});

describe('homeGoal', () => {
  it('lets a project orbit its second goal when the first leaves the sky', () => {
    const projects = demoRecords.projects.map((p) => (p.id === 'p-meal-prep' ? { ...p, goalIds: ['g-health', 'g-people'] } : p));
    const goals = demoRecords.goals.map((g) => (g.id === 'g-health' ? { ...g, state: 'fulfilled' as const } : g));
    const l = layoutSky(goals, projects);
    expect(l.projects.find((p) => p.id === 'p-meal-prep')?.goalId).toBe('g-people');
    expect(l.projects.find((p) => p.id === 'p-5k')?.goalId).toBeNull();
  });
});
