import { create } from "zustand";

export interface OpenFile {
  content: string;
  language: string;
  isDirty: boolean;
  originalContent: string;
}

interface EditorStore {
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

export const useEditorStore = create<EditorStore>((set) => ({
  openFiles: new Map(),
  activeFile: null,
  expandedDirs: new Set(),

  openFile: (path, content, language) => {
    set((state) => {
      const openFiles = new Map(state.openFiles);
      // Only set content if not already open (preserve edits)
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
        // Switch to the last remaining tab, or null
        const keys = Array.from(openFiles.keys());
        nextActive = keys.length > 0 ? (keys[keys.length - 1] ?? null) : null;
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
