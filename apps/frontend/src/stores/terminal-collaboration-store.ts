import { create } from "zustand";
import type {
  CollaborationStateEvent,
  CollaboratorInfo,
  TerminalLockChangedEvent,
  TerminalLockInfo,
  TerminalTypingEvent,
} from "@terminal-proxy/shared-types";

type TypingByTerminal = Record<string, Record<string, TerminalTypingEvent>>;

interface TerminalCollaborationStore {
  collaborators: Record<string, CollaboratorInfo>;
  locks: Record<string, TerminalLockInfo>;
  typingByTerminal: TypingByTerminal;
  setSnapshot: (event: CollaborationStateEvent) => void;
  collaboratorJoined: (collaborator: CollaboratorInfo) => void;
  collaboratorLeft: (clientId: string) => void;
  setTerminalLock: (event: TerminalLockChangedEvent) => void;
  markTyping: (event: TerminalTypingEvent) => void;
  clearTyping: (terminalId: string, clientId: string) => void;
  clearTerminalState: (terminalId: string) => void;
}

export const useTerminalCollaborationStore = create<TerminalCollaborationStore>((set) => ({
  collaborators: {},
  locks: {},
  typingByTerminal: {},

  setSnapshot: (event) => {
    set({
      collaborators: Object.fromEntries(
        event.collaborators.map((collaborator) => [collaborator.clientId, collaborator]),
      ),
      locks: Object.fromEntries(event.locks.map((lock) => [lock.terminalId, lock])),
    });
  },

  collaboratorJoined: (collaborator) => {
    set((state) => ({
      collaborators: {
        ...state.collaborators,
        [collaborator.clientId]: collaborator,
      },
    }));
  },

  collaboratorLeft: (clientId) => {
    set((state) => {
      const collaborators = { ...state.collaborators };
      delete collaborators[clientId];

      const typingByTerminal: TypingByTerminal = {};
      for (const [terminalId, typers] of Object.entries(state.typingByTerminal)) {
        const nextTypers = { ...typers };
        delete nextTypers[clientId];
        typingByTerminal[terminalId] = nextTypers;
      }

      const locks = { ...state.locks };
      for (const [terminalId, lock] of Object.entries(locks)) {
        if (lock.clientId === clientId) {
          delete locks[terminalId];
        }
      }

      return {
        collaborators,
        locks,
        typingByTerminal,
      };
    });
  },

  setTerminalLock: ({ terminalId, lock }) => {
    set((state) => {
      const locks = { ...state.locks };
      if (lock) {
        locks[terminalId] = lock;
      } else {
        delete locks[terminalId];
      }

      return { locks };
    });
  },

  markTyping: (event) => {
    set((state) => ({
      typingByTerminal: {
        ...state.typingByTerminal,
        [event.terminalId]: {
          ...(state.typingByTerminal[event.terminalId] ?? {}),
          [event.clientId]: event,
        },
      },
    }));
  },

  clearTyping: (terminalId, clientId) => {
    set((state) => {
      const terminalTyping = state.typingByTerminal[terminalId];
      if (!terminalTyping?.[clientId]) return state;

      const nextTerminalTyping = { ...terminalTyping };
      delete nextTerminalTyping[clientId];

      return {
        typingByTerminal: {
          ...state.typingByTerminal,
          [terminalId]: nextTerminalTyping,
        },
      };
    });
  },

  clearTerminalState: (terminalId) => {
    set((state) => {
      const locks = { ...state.locks };
      delete locks[terminalId];

      const typingByTerminal = { ...state.typingByTerminal };
      delete typingByTerminal[terminalId];

      return { locks, typingByTerminal };
    });
  },
}));
