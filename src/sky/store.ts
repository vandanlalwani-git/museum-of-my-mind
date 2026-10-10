/** The sky's state shared with the rest of the shell: list or sky, and a way to send a point of light into it. */
import { create } from 'zustand';
import type { MoteTarget } from './engine';

export type SkyMode = 'sky' | 'list';
export type SkyPeek = { kind: 'thought'; id: string } | { kind: 'question'; id: string } | { kind: 'new-galaxy' } | null;
const KEY = 'museum:sky-mode';
const saved = (): SkyMode | null => { try { const v = localStorage.getItem(KEY); return v === 'list' || v === 'sky' ? v : null; } catch { return null; } };

interface SkyState {
  /** True once the 3D sky is drawing; false when this browser cannot draw it. */
  live: boolean;
  /** Set when the 3D sky could not start; the list takes over everywhere. */
  failed: boolean;
  mode: SkyMode;
  peek: SkyPeek;
  launch: ((x: number, y: number, t: MoteTarget) => void) | null;
  setLive: (live: boolean) => void;
  setMode: (m: SkyMode) => void;
  setPeek: (p: SkyPeek) => void;
  setLaunch: (f: SkyState['launch']) => void;
}

export const useSky = create<SkyState>((set) => ({
  live: false,
  failed: false,
  mode: saved() ?? 'sky',
  peek: null,
  launch: null,
  setLive: (live) => set({ live }),
  setMode: (mode) => { try { localStorage.setItem(KEY, mode); } catch { /* storage may be off */ } set({ mode }); },
  setPeek: (peek) => set({ peek }),
  setLaunch: (launch) => set({ launch }),
}));
