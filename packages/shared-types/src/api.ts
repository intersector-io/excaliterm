import type { CanvasNode, CanvasEdge, Screenshot, TerminalSession, CommandHistory, CommandHistoryTopEntry } from "./models.js";

// ─── Terminal Sessions ──────────────────────────────────────────────────────

export interface CreateTerminalRequest {
  serviceInstanceId?: string;
  cols?: number;
  rows?: number;
  x?: number;
  y?: number;
  tags?: string[];
}

export interface UpdateTerminalRequest {
  tags?: string[];
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

// ─── Screenshots ───────────────────────────────────────────────────────────

export interface CreateScreenshotRequest {
  serviceInstanceId: string;
  imageData: string;
  monitorIndex: number;
  width: number;
  height: number;
  sourceTerminalNodeId: string;
  x?: number;
  y?: number;
}

export interface CreateScreenshotResponse {
  screenshot: Screenshot;
  canvasNode: CanvasNode;
  canvasEdge: CanvasEdge;
}

// ─── Editor Nodes ─────────────────────────────────────────────────────────

export interface CreateEditorNodeRequest {
  serviceInstanceId: string;
  x?: number;
  y?: number;
}

export interface CreateEditorNodeResponse {
  canvasNode: CanvasNode;
  canvasEdge: CanvasEdge;
}

// ─── Canvas Edges ──────────────────────────────────────────────────────────

export interface ListCanvasEdgesResponse {
  edges: CanvasEdge[];
}

// ─── Command History ────────────────────────────────────────────────────────

export interface SaveCommandRequest {
  terminalSessionId: string;
  command: string;
}

export interface SaveCommandResponse {
  command: CommandHistory;
}

export interface ListCommandHistoryResponse {
  commands: CommandHistory[];
}

export interface TopCommandsResponse {
  commands: CommandHistoryTopEntry[];
}

export interface CreateCommandHistoryNodeRequest {
  terminalSessionId: string;
  sourceTerminalNodeId: string;
  x?: number;
  y?: number;
}

export interface CreateCommandHistoryNodeResponse {
  canvasNode: CanvasNode;
  canvasEdge: CanvasEdge;
}

// ─── Health ─────────────────────────────────────────────────────────────────

export interface HealthResponse {
  status: "ok";
  serviceConnected: boolean;
  connectedServices?: number;
  timestamp: string;
}
