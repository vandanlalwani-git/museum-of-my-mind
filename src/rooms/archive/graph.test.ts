import { describe, expect, it } from 'vitest';
import { buildGraph, itemKind, neighboursOf } from './graph';
import { demoRecords } from '@/data/seed/demo';

describe('archive graph', () => {
  it('is deterministic', () => {
    const a = buildGraph(demoRecords);
    const b = buildGraph(demoRecords);
    expect(a.nodes.map((n) => [n.id, Math.round(n.x), Math.round(n.y)])).toEqual(b.nodes.map((n) => [n.id, Math.round(n.x), Math.round(n.y)]));
  });

  it('draws items, their tags, and only the goals and projects reached by threads', () => {
    const g = buildGraph(demoRecords);
    const kinds = new Map<string, number>();
    for (const n of g.nodes) kinds.set(n.kind, (kinds.get(n.kind) ?? 0) + 1);
    expect(kinds.get('note')).toBe(5);
    expect(kinds.get('idea')).toBe(3);
    expect(kinds.get('link')).toBe(5);
    expect(kinds.get('memory')).toBe(5);
    expect(g.byId.has('p-budget-app')).toBe(true);   // reached by n-3 and n-2
    expect(g.byId.has('g-people')).toBe(true);       // reached by m-3
    expect(g.byId.has('p-podcast')).toBe(false);     // nothing threads to it
    expect(g.byId.has('tag:health')).toBe(true);
  });

  it('keeps archived items off the map and every node inside the frame', () => {
    const rec = { ...demoRecords, notes: demoRecords.notes.map((n, i) => (i === 0 ? { ...n, archivedAt: 1 } : n)) };
    const g = buildGraph(rec);
    expect(g.byId.has(demoRecords.notes[0]!.id)).toBe(false);
    for (const n of g.nodes) {
      expect(n.x).toBeGreaterThanOrEqual(0); expect(n.x).toBeLessThanOrEqual(g.width);
      expect(n.y).toBeGreaterThanOrEqual(0); expect(n.y).toBeLessThanOrEqual(g.height);
    }
  });

  it('reports neighbours through threads and tags', () => {
    const g = buildGraph(demoRecords);
    const n = neighboursOf(g, 'n-1');
    expect(n.has('p-5k')).toBe(true);
    expect(n.has('tag:running')).toBe(true);
    expect(n.has('tag:health')).toBe(true);
    expect(itemKind(demoRecords.notes[1]!)).toBe('idea');
  });
});
