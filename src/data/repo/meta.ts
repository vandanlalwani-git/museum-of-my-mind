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
} as const;
