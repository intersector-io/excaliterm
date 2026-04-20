import { create } from "zustand";

interface TerminalOutputStore {
  buffers: Map<string, string[]>;
  addOutput: (terminalId: string, data: string) => void;
  clearOutput: (terminalId: string) => void;
  getOutput: (terminalId: string) => string[];
  removeTerminal: (terminalId: string) => void;
}

export const useTerminalStore = create<TerminalOutputStore>((set, get) => ({
  buffers: new Map(),

  addOutput: (terminalId: string, data: string) => {
    set((state) => {
      const buffers = new Map(state.buffers);
      const existing = buffers.get(terminalId) ?? [];
      buffers.set(terminalId, [...existing, data]);
      return { buffers };
    });
  },

  clearOutput: (terminalId: string) => {
    set((state) => {
      const buffers = new Map(state.buffers);
      buffers.set(terminalId, []);
      return { buffers };
    });
  },

  getOutput: (terminalId: string) => {
    return get().buffers.get(terminalId) ?? [];
  },

  removeTerminal: (terminalId: string) => {
    set((state) => {
      const buffers = new Map(state.buffers);
      buffers.delete(terminalId);
      return { buffers };
    });
  },
}));
