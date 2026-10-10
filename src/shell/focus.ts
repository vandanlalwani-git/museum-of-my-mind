/**
 * What the keeper is looking at: a galaxy, a goal, or a project. Pages set
 * it; Capture uses it for sensible defaults and the sky flies to it.
 */
import { create } from 'zustand';

export interface Focus { galaxyId: string | null; goalId: string | null; projectId: string | null }

interface FocusState extends Focus {
  setFocus: (f: Partial<Focus>) => void;
  clearFocus: () => void;
}

export const useFocus = create<FocusState>((set) => ({
  galaxyId: null, goalId: null, projectId: null,
  setFocus: (f) => set({ galaxyId: null, goalId: null, projectId: null, ...f }),
  clearFocus: () => set({ galaxyId: null, goalId: null, projectId: null }),
}));

export type CaptureKind = 'thought' | 'question' | 'step' | 'memory';
export interface CapturePreset { kind?: CaptureKind; goalId?: string; projectId?: string; galaxyId?: string }

interface CaptureState {
  open: boolean;
  preset: CapturePreset;
  openCapture: (preset?: CapturePreset) => void;
  closeCapture: () => void;
}

export const useCapture = create<CaptureState>((set) => ({
  open: false,
  preset: {},
  openCapture: (preset = {}) => set({ open: true, preset }),
  closeCapture: () => set({ open: false }),
}));
