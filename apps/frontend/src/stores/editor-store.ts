import { createContext, useContext } from "react";
import { create, type StoreApi, useStore } from "zustand";

export interface OpenFile {
  content: string;
  language: string;
  isDirty: boolean;
  originalContent: string;
}

export interface EditorStore {
  openFiles: Map<string, OpenFile>;
  activeFile: string | null;
  expandedDirs: Set<string>;

  openFile: (path: string, content: string, language: string) => void;
  closeFile: (path: string) => void;
  setActiveFile: (path: string | null) => void;
  setDirty: (path: string, isDirty: boolean) => void;
  updateContent: (path: string, content: string) => void;
  markSaved: (path: string, content: string) => void;
  toggleDir: (path: string) => void;
  expandDir: (path: string) => void;
  collapseDir: (path: string) => void;
}

function createEditorStoreInstance(): StoreApi<EditorStore> {
  return create<EditorStore>((set) => ({
    openFiles: new Map(),
    activeFile: null,
    expandedDirs: new Set(),

    openFile: (path, content, language) => {
      set((state) => {
        const openFiles = new Map(state.openFiles);
        if (!openFiles.has(path)) {
          openFiles.set(path, {
            content,
            language,
            isDirty: false,
            originalContent: content,
          });
        }
        return { openFiles, activeFile: path };
      });
    },

    closeFile: (path) => {
      set((state) => {
        const openFiles = new Map(state.openFiles);
        openFiles.delete(path);

        let nextActive = state.activeFile;
        if (nextActive === path) {
          const keys = Array.from(openFiles.keys());
          nextActive = keys.length > 0 ? (keys.at(-1) ?? null) : null;
        }

        return { openFiles, activeFile: nextActive };
      });
    },

    setActiveFile: (path) => {
      set({ activeFile: path });
    },

    setDirty: (path, isDirty) => {
      set((state) => {
        const openFiles = new Map(state.openFiles);
        const file = openFiles.get(path);
        if (file) {
          openFiles.set(path, { ...file, isDirty });
        }
        return { openFiles };
      });
    },

    updateContent: (path, content) => {
      set((state) => {
        const openFiles = new Map(state.openFiles);
        const file = openFiles.get(path);
        if (file) {
          openFiles.set(path, {
            ...file,
            content,
            isDirty: content !== file.originalContent,
          });
        }
        return { openFiles };
      });
    },

    markSaved: (path, content) => {
      set((state) => {
        const openFiles = new Map(state.openFiles);
        const file = openFiles.get(path);
        if (file) {
          openFiles.set(path, {
            ...file,
            content,
            originalContent: content,
            isDirty: false,
          });
        }
        return { openFiles };
      });
    },

    toggleDir: (path) => {
      set((state) => {
        const expandedDirs = new Set(state.expandedDirs);
        if (expandedDirs.has(path)) {
          expandedDirs.delete(path);
        } else {
          expandedDirs.add(path);
        }
        return { expandedDirs };
      });
    },

    expandDir: (path) => {
      set((state) => {
        const expandedDirs = new Set(state.expandedDirs);
        expandedDirs.add(path);
        return { expandedDirs };
      });
    },

    collapseDir: (path) => {
      set((state) => {
        const expandedDirs = new Set(state.expandedDirs);
        expandedDirs.delete(path);
        return { expandedDirs };
      });
    },
  }));
}

// ─── Per-node store management ────────────────────────────────────────────

const stores = new Map<string, StoreApi<EditorStore>>();

export function getEditorStore(nodeId: string): StoreApi<EditorStore> {
  if (!stores.has(nodeId)) {
    stores.set(nodeId, createEditorStoreInstance());
  }
  return stores.get(nodeId)!;
}

export function removeEditorStore(nodeId: string): void {
  stores.delete(nodeId);
}

// ─── React context for scoped store access ────────────────────────────────

export const EditorStoreContext = createContext<StoreApi<EditorStore> | null>(null);

export function useEditorStore(): EditorStore;
export function useEditorStore<T>(selector: (state: EditorStore) => T): T;
export function useEditorStore<T>(selector?: (state: EditorStore) => T) {
  const store = useContext(EditorStoreContext);
  if (!store) {
    throw new Error("useEditorStore must be used within an EditorStoreContext.Provider");
  }
  return useStore(store, selector ?? ((s) => s as unknown as T));
}
