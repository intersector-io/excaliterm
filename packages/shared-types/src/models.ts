export type TerminalStatus = "active" | "disconnected" | "exited" | "error";

export interface TerminalSession {
  id: string;
  tags: string[];
  status: TerminalStatus;
  exitCode: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface CanvasNode {
  id: string;
  terminalSessionId: string | null;
  nodeType?: string;
  noteId?: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  createdAt: string;
  updatedAt: string;
}

export interface Workspace {
  id: string;
  name: string;
  createdAt: string;
  lastAccessedAt: string;
}

export interface ServiceInstance {
  id: string;
  workspaceId: string;
  name: string;
  status: "online" | "offline";
  lastSeenAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface Note {
  id: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  displayName: string;
  content: string;
  createdAt: string;
}

export interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number | null;
  modifiedAt: string | null;
}
