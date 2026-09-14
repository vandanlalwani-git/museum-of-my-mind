import { create } from 'zustand';
import { museumRepo } from '@/data/repo/museums';
import { META_KEYS, metaRepo } from '@/data/repo/meta';
import { loadMuseumRecords } from '@/data/repo/records';
import { ensureDemoSeeded } from '@/data/seed';
import { newId } from '@/lib/ids';
import { emptyRecords, type Museum, type MuseumRecords } from '@/types';

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
}));

