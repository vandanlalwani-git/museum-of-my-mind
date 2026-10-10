import { getDB } from '@/data/db';

export const metaRepo = {
  async get<T>(key: string): Promise<T | undefined> {
    const db = await getDB();
    const row = await db.get('meta', key);
    return row?.value as T | undefined;
  },
  async set(key: string, value: unknown): Promise<void> {
    const db = await getDB();
    await db.put('meta', { key, value });
  },
  async remove(key: string): Promise<void> {
    const db = await getDB();
    await db.delete('meta', key);
  },
};

export const META_KEYS = {
  activeMuseumId: 'activeMuseumId',
  settings: 'settings',
  schemaVersion: 'schemaVersion',
  demoSeedVersion: 'demoSeedVersion',
  lastBackupAt: 'lastBackupAt',
  /** Per museum: `focusGoal:<museumId>`, the goal pinned on Today. */
  focusGoal: (museumId: string) => `focusGoal:${museumId}`,
  // Version 4, the mind-first model.
  activeMindId: 'activeMindId',
  /** Set once the old rooms have been moved into the new model: { at, report }. */
  mindSwitchover: 'mindSwitchover',
  /** The full version 3 backup taken just before the switch-over: { at, json }. */
  preMindBackup: 'preMindBackup',
  /** The "your museum has moved in" note, shown once. */
  movedInNote: 'movedInNote',
  demoMindVersion: 'demoMindVersion',
  /** Set once this browser has shown the guided tour. */
  tourSeen: 'tourSeen',
  /** This device's pairing (Phase 17). Never exported in backups. */
  sync: 'sync',
} as const;
