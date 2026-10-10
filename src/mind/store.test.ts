import { beforeEach, describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { closeDB } from '@/data/db';
import { parseBackup } from '@/data/backup';
import { museumRepo } from '@/data/repo/museums';
import { META_KEYS, metaRepo } from '@/data/repo/meta';
import { loadMuseumRecords, writeMuseumRecords } from '@/data/repo/records';
import { emptyRecords } from '@/types';
import { buildDemoSnapshot, DEMO_MIND_ID } from './demo';
import { danglingReferences } from './backup';
import { mindOps } from './ops';
import { progressOf, search, suggestHome, unsorted } from './select';
import { useMind } from './store';
import { PROJECT_SHAPES } from './types';

const T = new Date(2026, 9, 1, 9).getTime();
const stamp = (id: string, museumId: string) => ({ id, museumId, createdAt: T, updatedAt: T, lastVisitedAt: T, tags: [] as string[] });

beforeEach(async () => {
  await closeDB();
  globalThis.indexedDB = new IDBFactory();
  useMind.setState({ status: 'idle', minds: [], mind: null, snap: null, movedIn: null });
});

async function seedOldMuseum() {
  await museumRepo.put({ id: 'old', name: 'My museum', kind: 'own', createdAt: T, lastEnteredAt: T });
  const r = emptyRecords();
  r.goals.push({ ...stamp('g1', 'old'), title: 'Learn the guitar', why: '', horizon: 'decade', state: 'active' });
  r.projects.push({ ...stamp('p1', 'old'), title: 'Learn the basic chords', summary: '', goalIds: ['g1'], status: 'active', progress: 0 });
  r.actions.push({ ...stamp('a1', 'old'), projectId: 'p1', text: 'Learn the G chord' });
  r.notes.push({ ...stamp('n1', 'old'), title: 'Try a beginner class', body: '' });
  await writeMuseumRecords(r);
  await metaRepo.set(META_KEYS.activeMuseumId, 'old');
}

describe('the switch-over', () => {
  it('backs up first, moves an own museum in, keeps the old stores, and opens it', async () => {
    await seedOldMuseum();
    await useMind.getState().boot();
    const st = useMind.getState();
    expect(st.status).toBe('ready');
    expect(st.mind?.kind).toBe('own');
    expect(st.snap?.galaxies.map((g) => g.name)).toEqual(['My museum']);
    expect(st.snap?.goals[0]?.title).toBe('Learn the guitar');
    expect(st.movedIn?.thoughts).toBe(1);

    const saved = await metaRepo.get<{ at: number; json: string }>(META_KEYS.preMindBackup);
    expect(parseBackup(saved!.json).records.goals).toHaveLength(1);
    expect((await loadMuseumRecords('old')).actions).toHaveLength(1); // the old stores are untouched
    expect(st.minds.map((m) => m.id).sort()).toEqual([DEMO_MIND_ID, st.mind!.id].sort());
  });

  it('runs once only', async () => {
    await seedOldMuseum();
    await useMind.getState().boot();
    const first = useMind.getState().mind!.id;
    useMind.setState({ status: 'idle' });
    await useMind.getState().boot();
    expect(useMind.getState().minds.filter((m) => m.kind === 'own').map((m) => m.id)).toEqual([first]);
  });

  it('a first-time visitor gets only the demo and no museum is opened', async () => {
    await useMind.getState().boot();
    const st = useMind.getState();
    expect(st.mind).toBeNull();
    expect(st.minds.map((m) => m.id)).toEqual([DEMO_MIND_ID]);
    expect(st.movedIn).toBeNull();
  });
});

describe('where a visitor lands', () => {
  it('someone who was only looking at the old demo starts at the tour, not inside the demo', async () => {
    await museumRepo.put({ id: 'demo', name: 'Demo', kind: 'demo', createdAt: T, lastEnteredAt: T });
    await metaRepo.set(META_KEYS.activeMuseumId, 'demo');
    await useMind.getState().boot();
    expect(useMind.getState().mind).toBeNull();
    expect(await metaRepo.get(META_KEYS.activeMindId)).toBeUndefined();
  });

  it('an earlier version that left the demo open is corrected until the tour has been seen', async () => {
    await useMind.getState().boot();
    await metaRepo.set(META_KEYS.activeMindId, DEMO_MIND_ID);
    useMind.setState({ status: 'idle', mind: null, snap: null });
    await useMind.getState().boot();
    expect(useMind.getState().mind).toBeNull();

    await useMind.getState().markTourSeen();
    await metaRepo.set(META_KEYS.activeMindId, DEMO_MIND_ID);
    useMind.setState({ status: 'idle', mind: null, snap: null });
    await useMind.getState().boot();
    expect(useMind.getState().mind?.id).toBe(DEMO_MIND_ID); // chosen on purpose after the tour, so it stays
  });
});

describe('living in a mind', () => {
  it('captures, sorts, completes and undoes, writing through to storage', async () => {
    await useMind.getState().boot();
    await useMind.getState().createMind({ name: 'Mine', galaxyName: 'Personal' });
    const gx = useMind.getState().snap!.galaxies[0]!;
    const goal = await mindOps.addGoal({ galaxyId: gx.id, title: 'Learn the guitar', why: 'I feel like myself' });
    const proj = await mindOps.addProject({ galaxyId: gx.id, goalId: goal.id, title: 'Fifty songs', shape: { kind: 'number', target: 50, unit: 'songs', start: 11 } });
    const step = await mindOps.addStep({ projectId: proj.id, text: 'Learn one new song', kind: 'repeat', repeat: { every: 'week', day: 0 } });

    const t = await mindOps.addThought({ text: 'Maybe a #guitar class on Saturdays?', galaxyId: gx.id });
    expect(t).toMatchObject({ state: 'unsorted', isQuestion: true, tags: ['guitar'] });
    expect(suggestHome(useMind.getState().snap!, 'a class to help me play the guitar')).toMatchObject({ kind: 'goal', id: goal.id });
    await mindOps.placeThought(t.id, { goalId: goal.id });
    expect(unsorted(useMind.getState().snap!)).toHaveLength(0);

    await mindOps.completeStep(step.id, { note: 'Happy Birthday' });
    expect(progressOf(useMind.getState().snap!, proj).done).toBe(12);
    await mindOps.undoStep(step.id);
    expect(progressOf(useMind.getState().snap!, proj).done).toBe(11);

    expect(await mindOps.addThoughts(['one', '', 'two?', '  three  '], gx.id)).toBe(3);

    // Everything survives a reload from storage.
    const id = useMind.getState().mind!.id;
    useMind.setState({ mind: null, snap: null });
    await useMind.getState().enter(id);
    const snap = useMind.getState().snap!;
    expect(snap.thoughts).toHaveLength(4);
    expect(snap.thoughts.find((x) => x.id === t.id)).toMatchObject({ state: 'kept', goalId: goal.id });
    expect(search(snap, 'fifty')[0]).toMatchObject({ kind: 'project', href: `/project/${proj.id}` });
  });

  it('the demo is whole, shows every project shape, and refuses deletion', async () => {
    const demo = buildDemoSnapshot(T);
    expect(danglingReferences(demo)).toEqual([]);
    expect(new Set(demo.projects.map((p) => p.shape.kind))).toEqual(new Set(PROJECT_SHAPES));
    expect(demo.thoughts.some((x) => x.isQuestion && x.state === 'unsorted')).toBe(true);
    for (const p of demo.projects) {
      const pr = progressOf(demo, p, T);
      expect(pr.fraction).toBeGreaterThanOrEqual(0);
      expect(pr.fraction).toBeLessThanOrEqual(1);
    }
    await useMind.getState().boot();
    await expect(useMind.getState().deleteMind(DEMO_MIND_ID)).rejects.toThrow('cannot be deleted');
  });
});
