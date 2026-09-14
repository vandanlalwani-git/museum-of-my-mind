import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Action, Goal, Link, Memory, Museum, Note, Project, Thread } from '@/types';

export const DB_NAME = 'museum-of-my-mind';
export const DB_VERSION = 1;

interface MetaEntry { key: string; value: unknown }

export interface MuseumDB extends DBSchema {
  museums: { key: string; value: Museum; indexes: { byKind: string } };
  goals: { key: string; value: Goal; indexes: { byMuseum: string } };
  projects: { key: string; value: Project; indexes: { byMuseum: string } };
  actions: { key: string; value: Action; indexes: { byMuseum: string; byProject: string } };
  notes: { key: string; value: Note; indexes: { byMuseum: string } };
  links: { key: string; value: Link; indexes: { byMuseum: string } };
  memories: { key: string; value: Memory; indexes: { byMuseum: string } };
  threads: { key: string; value: Thread; indexes: { byMuseum: string; byFrom: string; byTo: string } };
  meta: { key: string; value: MetaEntry };
}

let dbPromise: Promise<IDBPDatabase<MuseumDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<MuseumDB>> {
  if (!dbPromise) {
    dbPromise = openDB<MuseumDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          const museums = db.createObjectStore('museums', { keyPath: 'id' });
          museums.createIndex('byKind', 'kind');

          for (const name of ['goals', 'projects', 'notes', 'links', 'memories'] as const) {
            const store = db.createObjectStore(name, { keyPath: 'id' });
            store.createIndex('byMuseum', 'museumId');
          }
          const actions = db.createObjectStore('actions', { keyPath: 'id' });
          actions.createIndex('byMuseum', 'museumId');
          actions.createIndex('byProject', 'projectId');

          const threads = db.createObjectStore('threads', { keyPath: 'id' });
          threads.createIndex('byMuseum', 'museumId');
          threads.createIndex('byFrom', 'fromId');
          threads.createIndex('byTo', 'toId');

          db.createObjectStore('meta', { keyPath: 'key' });
        }
      },
      blocked() { console.warn('[museum] database upgrade blocked by another tab'); },
      blocking() { console.warn('[museum] this tab is blocking a database upgrade'); },
    });
  }
  return dbPromise;
}

/** Test helper: close and forget the cached connection. */
export async function closeDB(): Promise<void> {
  if (dbPromise) {
    const db = await dbPromise;
    db.close();
    dbPromise = null;
  }
}
