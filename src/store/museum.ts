import { create } from 'zustand';
import { museumRepo } from '@/data/repo/museums';
import { META_KEYS, metaRepo } from '@/data/repo/meta';
import { loadMuseumRecords, repos } from '@/data/repo/records';
import { ensureDemoSeeded } from '@/data/seed';
import { newId } from '@/lib/ids';
import { emptyRecords, type Museum, type MuseumRecords, type RecordMap, type RecordType } from '@/types';

type Status = 'idle' | 'booting' | 'ready' | 'error';

interface MuseumState {
  status: Status;
  error?: string;
  museums: Museum[];
  activeMuseumId: string | null;
  active: Museum | null;
  records: MuseumRecords;
  hydrated: boolean;

  boot: () => Promise<void>;
  enter: (museumId: string) => Promise<void>;
  leave: () => Promise<void>;
  createOwnMuseum: (name: string, visitorName?: string) => Promise<Museum>;
  refreshMuseums: () => Promise<void>;

  /** Write a record to IndexedDB and reflect it in memory. */
  upsert: <T extends RecordType>(type: T, record: RecordMap[T]) => Promise<void>;
  /** Write several records of one type in a single transaction. */
  upsertMany: <T extends RecordType>(type: T, records: RecordMap[T][]) => Promise<void>;
  remove: (type: RecordType, id: string) => Promise<void>;
  /** Mark a record as visited now (drives Cabinet and Workshop dust). */
  touch: (type: RecordType, id: string) => Promise<void>;
}

export const useMuseumStore = create<MuseumState>((set, get) => ({
  status: 'idle',
  museums: [],
  activeMuseumId: null,
  active: null,
  records: emptyRecords(),
  hydrated: false,

  async boot() {
    if (get().status !== 'idle') return;
    set({ status: 'booting' });
    try {
      await ensureDemoSeeded();
      const museums = await museumRepo.list();
      const activeMuseumId = (await metaRepo.get<string>(META_KEYS.activeMuseumId)) ?? null;
      const active = museums.find((m) => m.id === activeMuseumId) ?? null;
      if (active) await get().enter(active.id);
      else set({ museums, activeMuseumId: null, active: null });
      set({ status: 'ready' });
    } catch (e) {
      set({ status: 'error', error: e instanceof Error ? e.message : String(e) });
    }
  },

  async enter(museumId) {
    const museum = await museumRepo.get(museumId);
    if (!museum) throw new Error('That museum does not exist.');
    const records = await loadMuseumRecords(museumId);
    const updated = { ...museum, lastEnteredAt: Date.now() };
    await museumRepo.put(updated);
    await metaRepo.set(META_KEYS.activeMuseumId, museumId);
    const museums = await museumRepo.list();
    set({ activeMuseumId: museumId, active: updated, records, hydrated: true, museums });
  },

  async leave() {
    await metaRepo.remove(META_KEYS.activeMuseumId);
    set({ activeMuseumId: null, active: null, records: emptyRecords(), hydrated: false });
  },

  async createOwnMuseum(name, visitorName) {
    const now = Date.now();
    const museum: Museum = {
      id: newId(),
      name: name.trim() || 'My Museum',
      kind: 'own',
      createdAt: now,
      lastEnteredAt: now,
      ...(visitorName?.trim() ? { visitorName: visitorName.trim() } : {}),
    };
    await museumRepo.put(museum);
    await get().refreshMuseums();
    return museum;
  },

  async refreshMuseums() {
    set({ museums: await museumRepo.list() });
  },

  async upsert(type, record) {
    await (repos[type].put as (r: unknown) => Promise<unknown>)(record);
    set((s) => {
      const list = s.records[type] as { id: string }[];
      const i = list.findIndex((r) => r.id === record.id);
      const next = i === -1 ? [...list, record] : list.map((r, j) => (j === i ? record : r));
      return { records: { ...s.records, [type]: next } };
    });
  },

  async upsertMany(type, records) {
    await (repos[type].putMany as (r: unknown[]) => Promise<void>)(records);
    set((s) => {
      const byId = new Map((s.records[type] as { id: string }[]).map((r) => [r.id, r]));
      for (const r of records) byId.set(r.id, r);
      return { records: { ...s.records, [type]: [...byId.values()] } };
    });
  },

  async remove(type, id) {
    await repos[type].remove(id);
    set((s) => ({ records: { ...s.records, [type]: (s.records[type] as { id: string }[]).filter((r) => r.id !== id) } }));
  },

  async touch(type, id) {
    const existing = (get().records[type] as { id: string; lastVisitedAt: number }[]).find((r) => r.id === id);
    if (!existing) return;
    await get().upsert(type, { ...existing, lastVisitedAt: Date.now() } as RecordMap[typeof type]);
  },
}));

