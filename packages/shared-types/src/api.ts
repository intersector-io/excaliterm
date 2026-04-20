import type { CanvasNode, TerminalSession } from "./models.js";

// ─── Terminal Sessions ──────────────────────────────────────────────────────

export interface CreateTerminalRequest {
  cols?: number;
  rows?: number;
  x?: number;
  y?: number;
}

export interface CreateTerminalResponse {
  terminal: TerminalSession;
  canvasNode: CanvasNode;
}

export interface ListTerminalsResponse {
  terminals: TerminalSession[];
}

// ─── Canvas Nodes ───────────────────────────────────────────────────────────

export interface UpdateCanvasNodeRequest {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  zIndex?: number;
}

export interface ListCanvasNodesResponse {
  nodes: CanvasNode[];
}

// ─── Health ─────────────────────────────────────────────────────────────────

export interface HealthResponse {
  status: "ok";
  serviceConnected: boolean;
  connectedServices?: number;
  timestamp: string;
}
