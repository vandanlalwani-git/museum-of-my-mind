import { create } from 'zustand';
import { META_KEYS, metaRepo } from '@/data/repo/meta';
import { defaultSettings, type Settings } from '@/types';
import { setSoundEnabled } from '@/lib/sound';

interface SettingsState extends Settings {
  loaded: boolean;
  load: () => Promise<void>;
  update: (patch: Partial<Settings>) => Promise<void>;
}

function applyToDocument(s: Settings) {
  setSoundEnabled(s.soundEnabled);
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.reduceMotion = s.reduceMotion;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  ...defaultSettings,
  loaded: false,
  async load() {
    const saved = await metaRepo.get<Partial<Settings>>(META_KEYS.settings);
    const merged = { ...defaultSettings, ...saved };
    applyToDocument(merged);
    set({ ...merged, loaded: true });
  },
  async update(patch) {
    const { soundEnabled, reduceMotion } = get();
    const next: Settings = { soundEnabled, reduceMotion, ...patch };
    applyToDocument(next);
    set(next);
    await metaRepo.set(META_KEYS.settings, next);
  },
}));
