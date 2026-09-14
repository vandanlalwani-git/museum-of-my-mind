import { getDB } from '@/data/db';
import type { Museum } from '@/types';
import { clearMuseumRecords } from './records';

export const museumRepo = {
  async list(): Promise<Museum[]> {
    const db = await getDB();
    const all = await db.getAll('museums');
    return all.sort((a, b) => b.lastEnteredAt - a.lastEnteredAt);
  },
  async get(id: string): Promise<Museum | undefined> {
    const db = await getDB();
    return db.get('museums', id);
  },
  async put(museum: Museum): Promise<Museum> {
    const db = await getDB();
    await db.put('museums', museum);
    return museum;
  },
  async remove(id: string): Promise<void> {
    await clearMuseumRecords(id);
    const db = await getDB();
    await db.delete('museums', id);
  },
};
