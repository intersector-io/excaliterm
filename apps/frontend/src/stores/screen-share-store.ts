import { create } from "zustand";
import type { Node } from "@xyflow/react";
import type { ScreenShareNodeData } from "@/hooks/use-canvas";

interface FrameData {
  imageBase64: string;
  width: number;
  height: number;
}

interface SessionState {
  sessionId: string;
  serviceId: string;
  monitorIndex: number;
  status: "connecting" | "streaming" | "stopped";
  currentFrame: FrameData | null;
}

interface ScreenShareStore {
  nodes: Node<ScreenShareNodeData>[];
  sessions: Map<string, SessionState>;
  addNode: (node: Node<ScreenShareNodeData>) => void;
  removeNode: (sessionId: string) => void;
  addSession: (sessionId: string, serviceId: string, monitorIndex: number) => void;
  removeSession: (sessionId: string) => void;
  updateFrame: (sessionId: string, frame: FrameData) => void;
  getSession: (sessionId: string) => SessionState | undefined;
  clear: () => void;
}

export const useScreenShareStore = create<ScreenShareStore>((set, get) => ({
  nodes: [],
  sessions: new Map(),
  addNode: (node) =>
    set((state) => ({
      nodes: [...state.nodes.filter((n) => n.id !== node.id), node],
    })),
  removeNode: (sessionId) =>
    set((state) => ({
      nodes: state.nodes.filter((n) => n.id !== `stream-${sessionId}`),
    })),
  addSession: (sessionId, serviceId, monitorIndex) =>
    set((state) => {
      const sessions = new Map(state.sessions);
      sessions.set(sessionId, { sessionId, serviceId, monitorIndex, status: "streaming", currentFrame: null });
      return { sessions };
    }),
  removeSession: (sessionId) =>
    set((state) => {
      const sessions = new Map(state.sessions);
      sessions.delete(sessionId);
      return { sessions };
    }),
  updateFrame: (sessionId, frame) =>
    set((state) => {
      const sessions = new Map(state.sessions);
      const existing = sessions.get(sessionId);
      if (existing) {
        sessions.set(sessionId, { ...existing, currentFrame: frame, status: "streaming" });
      }
      return { sessions };
    }),
  getSession: (sessionId) => get().sessions.get(sessionId),
  clear: () => set({ nodes: [], sessions: new Map() }),
}));
