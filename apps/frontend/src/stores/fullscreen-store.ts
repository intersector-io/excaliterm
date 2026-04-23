import { create } from "zustand";
import type { TerminalStatus } from "@excaliterm/shared-types";

interface FullscreenTerminal {
  terminalId: string;
  status: TerminalStatus;
  tags?: string[];
}

interface FullscreenStore {
  terminal: FullscreenTerminal | null;
  open: (terminal: FullscreenTerminal) => void;
  close: () => void;
}

export const useFullscreenStore = create<FullscreenStore>((set) => ({
  terminal: null,
  open: (terminal) => {
    window.location.hash = `focus=${terminal.terminalId}`;
    set({ terminal });
  },
  close: () => {
    if (window.location.hash.startsWith("#focus=")) {
      history.replaceState(null, "", window.location.pathname + window.location.search);
    }
    set({ terminal: null });
  },
}));
