import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Action, Goal, Link, Memory, Museum, Note, Project, Reflection, Scenario, Thread } from '@/types';

export const DB_NAME = 'museum-of-my-mind';
export const DB_VERSION = 3;

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
  scenarios: { key: string; value: Scenario; indexes: { byMuseum: string } };
  reflections: { key: string; value: Reflection; indexes: { byMuseum: string } };
  meta: { key: string; value: MetaEntry };
}

let dbPromise: Promise<IDBPDatabase<MuseumDB>> | null = null;

/**
 * Set when another tab (or a pending "clear site data") is holding the
 * database open so this one cannot proceed. Opening then never settles, so
 * callers need a way to tell a hang from slowness.
 */
let blockedByAnotherTab = false;
export function isBlockedByAnotherTab(): boolean { return blockedByAnotherTab; }

/** Reject rather than hang forever if the database never opens. */
export async function withOpenTimeout<T>(work: Promise<T>, ms = 10_000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('database-unavailable')), ms); }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

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
        if (oldVersion < 2) {
          // Phase 4: saved Future Gallery scenarios.
          const scenarios = db.createObjectStore('scenarios', { keyPath: 'id' });
          scenarios.createIndex('byMuseum', 'museumId');
        }
        if (oldVersion < 3) {
          // Phase 7: kept "Ask my AI" results (accepted proposals only; never keys).
          const reflections = db.createObjectStore('reflections', { keyPath: 'id' });
          reflections.createIndex('byMuseum', 'museumId');
        }
      },
      blocked() {
        blockedByAnotherTab = true;
        console.warn('[museum] another tab is holding the museum open');
      },
      blocking() {
        // Step aside so the other tab can finish its upgrade rather than
        // leaving both tabs stuck waiting on each other.
        console.warn('[museum] stepping aside for an upgrade in another tab');
        const closing = dbPromise;
        dbPromise = null;
        void closing?.then((db) => db.close()).catch(() => undefined);
      },
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
