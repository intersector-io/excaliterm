import { create } from "zustand";

interface FitNodesArgs {
  nodeIds: string[];
  padding?: number;
  maxZoom?: number;
  duration?: number;
}

interface CanvasImperativesStore {
  fitNodes: ((args: FitNodesArgs) => void) | null;
  setFitNodes: (fn: ((args: FitNodesArgs) => void) | null) => void;
}

export const useCanvasImperativesStore = create<CanvasImperativesStore>((set) => ({
  fitNodes: null,
  setFitNodes: (fn) => set({ fitNodes: fn }),
}));
