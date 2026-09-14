import { create } from 'zustand';

export interface QuietMessage {
  id: number;
  text: string;
}

interface UiState {
  message: QuietMessage | null;
  say: (text: string, ms?: number) => void;
  hush: () => void;
  installPrompt: BeforeInstallPromptEvent | null;
  setInstallPrompt: (e: BeforeInstallPromptEvent | null) => void;
  roomsVisited: number;
  noteRoomVisit: () => void;
}

let counter = 0;
let timer: ReturnType<typeof setTimeout> | undefined;

export const useUiStore = create<UiState>((set, get) => ({
  message: null,
  say(text, ms = 4200) {
    if (timer) clearTimeout(timer);
    const id = ++counter;
    set({ message: { id, text } });
    timer = setTimeout(() => {
      if (get().message?.id === id) set({ message: null });
    }, ms);
  },
  hush() {
    if (timer) clearTimeout(timer);
    set({ message: null });
  },
  installPrompt: null,
  setInstallPrompt: (e) => set({ installPrompt: e }),
  roomsVisited: 0,
  noteRoomVisit: () => set((s) => ({ roomsVisited: s.roomsVisited + 1 })),
}));

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}
