/**
 * The mind store: the open museum held in memory. Components call this; it
 * calls the repository. Every write goes to IndexedDB first, then memory.
 */
import { create } from 'zustand';
import { isBlockedByAnotherTab, withOpenTimeout } from '@/data/db';
import { META_KEYS, metaRepo } from '@/data/repo/meta';
import { newId } from '@/lib/ids';
import { DEMO_MIND_ID, ensureDemoMind, resetDemoMind } from './demo';
import type { MigrationReport } from './migrate';
import { clearMind, loadSnapshot, mindRepo, putRecords, writeSnapshot, type RecordOf } from './repo';
import { runSwitchover } from './switchover';
import { emptySnapshot, type Galaxy, type Mind, type MindCollection, type MindSnapshot } from './types';

type Status = 'idle' | 'booting' | 'ready' | 'error';

export interface CreateMindInput { name: string; visitorName?: string; galaxyName?: string }

interface MindState {
  status: Status;
  error?: string;
  minds: Mind[];
  mind: Mind | null;
  snap: MindSnapshot | null;
  /** The one-time "your museum has moved in" note. */
  movedIn: MigrationReport | null;

  boot: () => Promise<void>;
  enter: (mindId: string) => Promise<void>;
  leave: () => Promise<void>;
  createMind: (input: CreateMindInput) => Promise<Mind>;
  deleteMind: (mindId: string) => Promise<void>;
  resetDemo: () => Promise<void>;
  dismissMovedIn: () => Promise<void>;
  renameMind: (name: string) => Promise<void>;
  /** Writes records of one collection to storage, then to memory. */
  put: <C extends MindCollection>(c: C, records: RecordOf<C> | RecordOf<C>[]) => Promise<void>;
  /** Replaces the open mind with a snapshot (after an import). */
  reload: () => Promise<void>;
  /** Takes the museum's own row from a paired device. */
  applyMindRow: (mind: Mind) => Promise<void>;
}

export const useMind = create<MindState>((set, get) => ({
  status: 'idle',
  minds: [],
  mind: null,
  snap: null,
  movedIn: null,

  async boot() {
    if (get().status !== 'idle') return;
    set({ status: 'booting' });
    try {
      await withOpenTimeout((async () => {
        await runSwitchover();
        await ensureDemoMind();
        const movedIn = (await metaRepo.get<MigrationReport>(META_KEYS.movedInNote)) ?? null;
        const minds = await mindRepo.list();
        const activeId = (await metaRepo.get<string>(META_KEYS.activeMindId)) ?? null;
        set({ minds, movedIn });
        if (activeId && minds.some((m) => m.id === activeId)) await get().enter(activeId);
      })());
      set({ status: 'ready' });
    } catch (e) {
      const unavailable = e instanceof Error && e.message === 'database-unavailable';
      set({
        status: 'error',
        error: unavailable || isBlockedByAnotherTab()
          ? 'Another tab has this museum open, or the browser is still clearing its storage. Close the other tabs and reload.'
          : e instanceof Error ? e.message : String(e),
      });
    }
  },

  async enter(mindId) {
    const mind = await mindRepo.get(mindId);
    if (!mind) throw new Error('That museum does not exist.');
    const updated = { ...mind, lastEnteredAt: Date.now() };
    await mindRepo.put(updated);
    await metaRepo.set(META_KEYS.activeMindId, mindId);
    const snap = await loadSnapshot(updated);
    set({ mind: updated, snap, minds: await mindRepo.list() });
  },

  async leave() {
    await metaRepo.remove(META_KEYS.activeMindId);
    set({ mind: null, snap: null });
  },

  async createMind({ name, visitorName, galaxyName }) {
    const now = Date.now();
    const mind: Mind = {
      id: newId(), name: name.trim() || 'My Mind', kind: 'own', createdAt: now, lastEnteredAt: now,
      ...(visitorName?.trim() ? { visitorName: visitorName.trim() } : {}),
    };
    const snap = emptySnapshot(mind);
    const galaxy: Galaxy = {
      id: newId(), museumId: mind.id, createdAt: now, updatedAt: now, lastVisitedAt: now, tags: [],
      name: galaxyName?.trim() || 'Personal', hue: 'gold', order: 0,
    };
    snap.galaxies.push(galaxy);
    await writeSnapshot(snap);
    set({ minds: await mindRepo.list() });
    await get().enter(mind.id);
    return mind;
  },

  async deleteMind(mindId) {
    if (mindId === DEMO_MIND_ID) throw new Error('The demo cannot be deleted; reload it instead.');
    if (get().mind?.id === mindId) await get().leave();
    await clearMind(mindId);
    set({ minds: await mindRepo.list() });
  },

  async resetDemo() {
    await resetDemoMind();
    if (get().mind?.id === DEMO_MIND_ID) await get().enter(DEMO_MIND_ID);
  },

  async dismissMovedIn() {
    await metaRepo.remove(META_KEYS.movedInNote);
    set({ movedIn: null });
  },

  async renameMind(name) {
    const mind = get().mind;
    if (!mind || !name.trim()) return;
    const updated = { ...mind, name: name.trim(), updatedAt: Date.now() };
    await mindRepo.put(updated);
    set((s) => ({ mind: updated, snap: s.snap ? { ...s.snap, mind: updated } : s.snap, minds: s.minds.map((m) => (m.id === updated.id ? updated : m)) }));
  },

  async put(c, records) {
    const list = (Array.isArray(records) ? records : [records]) as RecordOf<typeof c>[];
    if (!list.length) return;
    await putRecords(c, list);
    set((s) => {
      if (!s.snap) return s;
      const byId = new Map((s.snap[c] as { id: string }[]).map((r) => [r.id, r]));
      for (const r of list as { id: string }[]) byId.set(r.id, r);
      return { snap: { ...s.snap, [c]: [...byId.values()] } };
    });
  },

  async applyMindRow(row) {
    await mindRepo.put(row);
    set((s) => ({
      minds: s.minds.some((m) => m.id === row.id) ? s.minds.map((m) => (m.id === row.id ? row : m)) : [...s.minds, row],
      ...(s.mind?.id === row.id ? { mind: row, snap: s.snap ? { ...s.snap, mind: row } : s.snap } : {}),
    }));
  },

  async reload() {
    const mind = get().mind;
    set({ minds: await mindRepo.list() });
    if (mind) await get().enter(mind.id);
  },
}));

/** Live records only: anything with a deletion marker is gone from every view. */
export function live<T extends { deletedAt?: number }>(xs: T[]): T[] {
  return xs.filter((x) => x.deletedAt === undefined);
}
