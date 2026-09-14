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
    expect(l.projects.map((p) => p.id)).not.toContain('p-birdcount');
  });

  it('places projects of a released goal adrift rather than dropping them', () => {
    const goals = demoRecords.goals.map((g) => (g.id === 'g-fog-guide' ? { ...g, state: 'fulfilled' as const } : g));
    const l = layoutSky(goals, demoRecords.projects);
    const fogTax = l.projects.find((p) => p.id === 'p-fog-taxonomy');
    expect(fogTax?.goalId).toBeNull();
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
    const next = nextForGoal('g-tide-clock', demoRecords.projects, demoRecords.actions);
    expect(next?.project.id).toBe('p-escapement');
    expect(next?.action.text).toBe('Carve the wax master for the wheel');
  });
  it('returns null when nothing is open', () => {
    expect(nextForGoal('g-lighthouses', demoRecords.projects, demoRecords.actions.map((a) => ({ ...a, doneAt: 1 })))).toBeNull();
  });
});

describe('homeGoal', () => {
  it('lets a project orbit its second goal when the first leaves the sky', () => {
    const goals = demoRecords.goals.map((g) => (g.id === 'g-tide-clock' ? { ...g, state: 'fulfilled' as const } : g));
    const l = layoutSky(goals, demoRecords.projects);
    expect(l.projects.find((p) => p.id === 'p-escapement')?.goalId).toBe('g-bronze');
    expect(l.projects.find((p) => p.id === 'p-clock-case')?.goalId).toBeNull();
  });
});
