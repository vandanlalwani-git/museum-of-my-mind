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
