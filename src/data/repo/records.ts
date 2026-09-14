import { getDB } from '@/data/db';
import { RECORD_TYPES, emptyRecords, type MuseumRecords, type RecordMap, type RecordType } from '@/types';

/** Generic repository for the seven museum record types. */
export function recordRepo<T extends RecordType>(type: T) {
  type R = RecordMap[T];
  return {
    async list(museumId: string): Promise<R[]> {
      const db = await getDB();
      return (await db.getAllFromIndex(type, 'byMuseum', IDBKeyRange.only(museumId))) as R[];
    },
    async get(id: string): Promise<R | undefined> {
      const db = await getDB();
      return (await db.get(type, id)) as R | undefined;
    },
    async put(record: R): Promise<R> {
      const db = await getDB();
      await db.put(type, record as never);
      return record;
    },
    async putMany(records: R[]): Promise<void> {
      const db = await getDB();
      const tx = db.transaction(type, 'readwrite');
      await Promise.all([...records.map((r) => tx.store.put(r as never)), tx.done]);
    },
    async remove(id: string): Promise<void> {
      const db = await getDB();
      await db.delete(type, id);
    },
    async clear(museumId: string): Promise<void> {
      const db = await getDB();
      const tx = db.transaction(type, 'readwrite');
      let cursor = await tx.store.index('byMuseum').openCursor(IDBKeyRange.only(museumId));
      while (cursor) {
        await cursor.delete();
        cursor = await cursor.continue();
      }
      await tx.done;
    },
  };
}

export const repos = {
  goals: recordRepo('goals'),
  projects: recordRepo('projects'),
  actions: recordRepo('actions'),
  notes: recordRepo('notes'),
  links: recordRepo('links'),
  memories: recordRepo('memories'),
  threads: recordRepo('threads'),
  scenarios: recordRepo('scenarios'),
  reflections: recordRepo('reflections'),
};

/** Load every record for a museum in a single read transaction. */
export async function loadMuseumRecords(museumId: string): Promise<MuseumRecords> {
  const db = await getDB();
  const tx = db.transaction(RECORD_TYPES, 'readonly');
  const out = emptyRecords();
  await Promise.all(
    RECORD_TYPES.map(async (type) => {
      const rows = await tx.objectStore(type).index('byMuseum').getAll(museumId);
      (out as Record<RecordType, unknown[]>)[type] = rows;
    }),
  );
  await tx.done;
  return out;
}

/** Write a whole record set for a museum in one transaction. */
export async function writeMuseumRecords(records: MuseumRecords): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(RECORD_TYPES, 'readwrite');
  const writes: Promise<unknown>[] = [];
  for (const type of RECORD_TYPES) {
    const store = tx.objectStore(type);
    for (const r of records[type]) writes.push(store.put(r as never));
  }
  await Promise.all([...writes, tx.done]);
}

/** Delete every record belonging to a museum. */
export async function clearMuseumRecords(museumId: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(RECORD_TYPES, 'readwrite');
  await Promise.all(
    RECORD_TYPES.map(async (type) => {
      let cursor = await tx.objectStore(type).index('byMuseum').openCursor(museumId);
      while (cursor) {
        await cursor.delete();
        cursor = await cursor.continue();
      }
    }),
  );
  await tx.done;
}
