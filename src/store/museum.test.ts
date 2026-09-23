import { beforeEach, describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { closeDB, withOpenTimeout } from '@/data/db';
import { loadMuseumRecords } from '@/data/repo/records';
import { META_KEYS, metaRepo } from '@/data/repo/meta';
import { makeGoal, makeProject, makeAction, touched } from '@/data/factories';
import { useMuseumStore } from '@/store/museum';
import { DEMO_MUSEUM_ID } from '@/data/seed';
import { exportBackup, importBackup } from '@/data/backup';

beforeEach(async () => {
  await closeDB();
  globalThis.indexedDB = new IDBFactory();
  useMuseumStore.setState({ status: 'idle', museums: [], activeMuseumId: null, active: null, hydrated: false });
});

describe('museum store persistence', () => {
  it('boots, seeds the demo, and remembers the active museum across a reboot', async () => {
    const s = useMuseumStore.getState();
    await s.boot();
    expect(useMuseumStore.getState().status).toBe('ready');
    expect(useMuseumStore.getState().hydrated).toBe(false);

    await useMuseumStore.getState().enter(DEMO_MUSEUM_ID);
    expect(useMuseumStore.getState().records.goals).toHaveLength(4);
    expect(await metaRepo.get(META_KEYS.activeMuseumId)).toBe(DEMO_MUSEUM_ID);

    // Simulate a browser restart: fresh store state, same database.
    useMuseumStore.setState({ status: 'idle', hydrated: false, active: null, activeMuseumId: null });
    await useMuseumStore.getState().boot();
    expect(useMuseumStore.getState().hydrated).toBe(true);
    expect(useMuseumStore.getState().active?.id).toBe(DEMO_MUSEUM_ID);
  });

  it('upsert, remove, and touch write through to IndexedDB', async () => {
    await useMuseumStore.getState().boot();
    const m = await useMuseumStore.getState().createOwnMuseum('Test');
    await useMuseumStore.getState().enter(m.id);

    const goal = makeGoal(m.id, { title: 'Goal', why: 'Because' });
    const project = makeProject(m.id, { title: 'Project', goalIds: [goal.id] });
    const action = makeAction(m.id, project.id, 'Do the thing');
    const st = useMuseumStore.getState();
    await st.upsert('goals', goal);
    await st.upsert('projects', project);
    await st.upsert('actions', action);

    let onDisk = await loadMuseumRecords(m.id);
    expect(onDisk.goals[0]?.title).toBe('Goal');
    expect(onDisk.actions[0]?.projectId).toBe(project.id);

    await st.upsert('goals', touched(goal, { title: 'Renamed', state: 'fulfilled' }, 999_999));
    onDisk = await loadMuseumRecords(m.id);
    expect(onDisk.goals).toHaveLength(1);
    expect(onDisk.goals[0]?.title).toBe('Renamed');
    expect(onDisk.goals[0]?.state).toBe('fulfilled');

    await st.remove('actions', action.id);
    expect((await loadMuseumRecords(m.id)).actions).toHaveLength(0);

    await st.touch('projects', project.id);
    const after = (await loadMuseumRecords(m.id)).projects[0]!;
    expect(after.lastVisitedAt).toBeGreaterThanOrEqual(project.lastVisitedAt);
  });
});

describe('import modes', () => {
  it('merge keeps local edits; replace restores the backup', async () => {
    await useMuseumStore.getState().boot();
    await useMuseumStore.getState().enter(DEMO_MUSEUM_ID);
    const backup = await exportBackup([DEMO_MUSEUM_ID]);

    const goal = useMuseumStore.getState().records.goals[0]!;
    await useMuseumStore.getState().upsert('goals', touched(goal, { title: 'Edited locally' }));

    await importBackup(backup, 'merge');
    let goals = (await loadMuseumRecords(DEMO_MUSEUM_ID)).goals;
    expect(goals.find((g) => g.id === goal.id)?.title).toBe('Edited locally');
    expect(goals).toHaveLength(4);

    await importBackup(backup, 'replace');
    goals = (await loadMuseumRecords(DEMO_MUSEUM_ID)).goals;
    expect(goals.find((g) => g.id === goal.id)?.title).toBe(goal.title);
    expect(goals).toHaveLength(4);
  });
});

describe('boot resilience', () => {
  it('bounds an open that never settles instead of hanging', async () => {
    const never = new Promise<never>(() => {});
    await expect(withOpenTimeout(never, 50)).rejects.toThrow('database-unavailable');
  });

  it('passes a normal open straight through', async () => {
    await expect(withOpenTimeout(Promise.resolve('open'), 1000)).resolves.toBe('open');
  });

  it('ends in a reported error, never stuck on booting, when storage is unusable', async () => {
    await closeDB();
    globalThis.indexedDB = { open() { throw new DOMException('denied', 'SecurityError'); }, databases: async () => [] } as unknown as IDBFactory;
    useMuseumStore.setState({ status: 'idle', museums: [], activeMuseumId: null, active: null, hydrated: false });

    await useMuseumStore.getState().boot();

    expect(useMuseumStore.getState().status).toBe('error');
    expect(useMuseumStore.getState().error).toBeTruthy();
    expect(useMuseumStore.getState().hydrated).toBe(false);
  });
});
