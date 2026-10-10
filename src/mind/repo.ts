/**
 * The only code that reads or writes the mind-first stores in IndexedDB.
 * Stores call this; components never do.
 */
import { getDB, MIND_STORE_NAMES } from '@/data/db';
import { MIND_COLLECTIONS, emptySnapshot, type Mind, type MindCollection, type MindSnapshot } from './types';

export type StoreName = (typeof MIND_STORE_NAMES)[number];
export const storeOf = (c: MindCollection): StoreName => `mind.${c}` as StoreName;
export type RecordOf<C extends MindCollection> = MindSnapshot[C][number];

export const mindRepo = {
  async list(): Promise<Mind[]> {
    return (await getDB()).getAll('minds');
  },
  async get(id: string): Promise<Mind | undefined> {
    return (await getDB()).get('minds', id);
  },
  async put(mind: Mind): Promise<void> {
    await (await getDB()).put('minds', mind);
  },
};

/** Every record of one mind, read in a single transaction. */
export async function loadSnapshot(mind: Mind): Promise<MindSnapshot> {
  const db = await getDB();
  const tx = db.transaction([...MIND_STORE_NAMES], 'readonly');
  const snap = emptySnapshot(mind);
  await Promise.all(MIND_COLLECTIONS.map(async (c) => {
    const rows = await tx.objectStore(storeOf(c)).index('byMuseum').getAll(IDBKeyRange.only(mind.id));
    (snap[c] as unknown[]) = rows;
  }));
  await tx.done;
  return snap;
}

export async function putRecords<C extends MindCollection>(c: C, records: RecordOf<C>[]): Promise<void> {
  if (!records.length) return;
  const db = await getDB();
  const tx = db.transaction(storeOf(c), 'readwrite');
  await Promise.all([...records.map((r) => tx.store.put(r as never)), tx.done]);
}

/** Writes a whole mind (its row and every record) in one transaction. */
export async function writeSnapshot(snap: MindSnapshot): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(['minds', ...MIND_STORE_NAMES], 'readwrite');
  const writes: Promise<unknown>[] = [tx.objectStore('minds').put(snap.mind)];
  for (const c of MIND_COLLECTIONS) for (const r of snap[c]) writes.push(tx.objectStore(storeOf(c)).put(r as never));
  await Promise.all([...writes, tx.done]);
}

/** Removes a mind and every record in it. Used for the demo refresh and the keeper's explicit delete. */
export async function clearMind(mindId: string, keepRow = false): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(['minds', ...MIND_STORE_NAMES], 'readwrite');
  for (const name of MIND_STORE_NAMES) {
    let cursor = await tx.objectStore(name).index('byMuseum').openCursor(IDBKeyRange.only(mindId));
    while (cursor) { await cursor.delete(); cursor = await cursor.continue(); }
  }
  if (!keepRow) await tx.objectStore('minds').delete(mindId);
  await tx.done;
}
