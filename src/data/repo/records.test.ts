import { beforeEach, describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { closeDB } from '@/data/db';
import { repos, loadMuseumRecords, clearMuseumRecords } from '@/data/repo/records';
import { museumRepo } from '@/data/repo/museums';
import { ensureDemoSeeded, DEMO_MUSEUM_ID, DEMO_SEED_VERSION } from '@/data/seed';
import { META_KEYS, metaRepo } from '@/data/repo/meta';
import { demoRecords } from '@/data/seed/demo';
import { exportBackup, importBackup, parseBackup, serializeBackup } from '@/data/backup';

beforeEach(async () => {
  await closeDB();
  globalThis.indexedDB = new IDBFactory();
});

describe('repositories', () => {
  it('round-trips a goal', async () => {
    const goal = { id: 'g1', museumId: 'm1', createdAt: 1, updatedAt: 1, lastVisitedAt: 1, tags: [], title: 'T', why: 'W', horizon: 'year' as const, state: 'active' as const };
    await repos.goals.put(goal);
    expect(await repos.goals.get('g1')).toEqual(goal);
    expect(await repos.goals.list('m1')).toHaveLength(1);
    expect(await repos.goals.list('other')).toHaveLength(0);
    await repos.goals.remove('g1');
    expect(await repos.goals.get('g1')).toBeUndefined();
  });

  it('seeds the demo once, refreshes it when the seed version rises, and hydrates it whole', async () => {
    expect(await ensureDemoSeeded()).toBe(true);
    expect(await ensureDemoSeeded()).toBe(false);
    await metaRepo.set(META_KEYS.demoSeedVersion, DEMO_SEED_VERSION - 1);
    expect(await ensureDemoSeeded()).toBe(true);
    expect(await metaRepo.get(META_KEYS.demoSeedVersion)).toBe(DEMO_SEED_VERSION);
    const rec = await loadMuseumRecords(DEMO_MUSEUM_ID);
    expect(rec.goals).toHaveLength(demoRecords.goals.length);
    expect(rec.projects).toHaveLength(demoRecords.projects.length);
    expect(rec.threads).toHaveLength(demoRecords.threads.length);
    await clearMuseumRecords(DEMO_MUSEUM_ID);
    expect((await loadMuseumRecords(DEMO_MUSEUM_ID)).goals).toHaveLength(0);
  });
});

describe('backup', () => {
  it('exports and re-imports losslessly', async () => {
    await ensureDemoSeeded();
    const before = await loadMuseumRecords(DEMO_MUSEUM_ID);
    const json = serializeBackup(await exportBackup());
    const parsed = parseBackup(json);

    await closeDB();
    globalThis.indexedDB = new IDBFactory();
    const result = await importBackup(parsed, 'merge');
    expect(result.museums).toBe(1);
    const after = await loadMuseumRecords(DEMO_MUSEUM_ID);
    expect(after).toEqual(before);
    expect((await museumRepo.get(DEMO_MUSEUM_ID))?.name).toBe("Alex's Next Chapter");
  });

  it('rejects foreign files', () => {
    expect(() => parseBackup('{"hello":1}')).toThrow();
    expect(() => parseBackup('not json')).toThrow();
    expect(() => parseBackup(JSON.stringify({ format: 'museum-of-my-mind-backup', schemaVersion: 1, museums: [], records: { goals: [{ id: 'x', museumId: 'ghost' }] } }))).toThrow(/not in this backup/);
  });
});

describe('schema v2', () => {
  it('upgrades a v1 database in place and keeps its records', async () => {
    await closeDB();
    globalThis.indexedDB = new IDBFactory();
    // Create a v1-shaped database by hand.
    const { openDB } = await import('idb');
    const v1 = await openDB('museum-of-my-mind', 1, {
      upgrade(db) {
        db.createObjectStore('museums', { keyPath: 'id' }).createIndex('byKind', 'kind');
        for (const n of ['goals', 'projects', 'notes', 'links', 'memories'] as const) db.createObjectStore(n, { keyPath: 'id' }).createIndex('byMuseum', 'museumId');
        const a = db.createObjectStore('actions', { keyPath: 'id' }); a.createIndex('byMuseum', 'museumId'); a.createIndex('byProject', 'projectId');
        const t = db.createObjectStore('threads', { keyPath: 'id' }); t.createIndex('byMuseum', 'museumId'); t.createIndex('byFrom', 'fromId'); t.createIndex('byTo', 'toId');
        db.createObjectStore('meta', { keyPath: 'key' });
      },
    });
    await v1.put('goals', { id: 'g', museumId: 'own', createdAt: 1, updatedAt: 1, lastVisitedAt: 1, tags: [], title: 'Old', why: '', horizon: 'year', state: 'active' });
    v1.close();

    const rec = await loadMuseumRecords('own');
    expect(rec.goals[0]?.title).toBe('Old');
    expect(rec.scenarios).toEqual([]);
    await repos.scenarios.put({ id: 's', museumId: 'own', createdAt: 1, updatedAt: 1, lastVisitedAt: 1, tags: [], name: 'W', goalId: 'g', hoursPerWeek: 3, consistency: 0.5, focus: 1, rest: 0.5 });
    expect((await loadMuseumRecords('own')).scenarios).toHaveLength(1);
  });

  it('imports a version 1 backup without scenarios', async () => {
    const parsed = parseBackup(JSON.stringify({ format: 'museum-of-my-mind-backup', schemaVersion: 1, exportedAt: '', museums: [{ id: 'm', name: 'M', kind: 'own', createdAt: 1, lastEnteredAt: 1 }], records: { goals: [], projects: [], actions: [], notes: [], links: [], memories: [], threads: [] } }));
    expect(parsed.records.scenarios).toEqual([]);
    const result = await importBackup(parsed, 'merge');
    expect(result.museums).toBe(1);
  });
});
