import type {
  CreateTerminalRequest,
  CreateTerminalResponse,
  ListTerminalsResponse,
  ListCanvasNodesResponse,
  UpdateCanvasNodeRequest,
  CanvasNode,
} from "@excaliterm/shared-types";

const BASE = "/api";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${body || res.statusText}`);
  }

  return res.json() as Promise<T>;
}

// ─── Workspaces ──────────────────────────────────────────────────────────────

export interface WorkspaceResponse {
  id: string;
  name: string;
  createdAt: string;
  lastAccessedAt: string;
}

export function createWorkspace(): Promise<WorkspaceResponse> {
  return request("/workspaces", { method: "POST" });
}

export function getWorkspace(id: string): Promise<WorkspaceResponse> {
  return request(`/workspaces/${id}`);
}

// ─── Terminals ──────────────────────────────────────────────────────────────

export function createTerminal(
  workspaceId: string,
  req: CreateTerminalRequest = {},
): Promise<CreateTerminalResponse> {
  return request(`/w/${workspaceId}/terminals`, {
    method: "POST",
    body: JSON.stringify(req),
  });
}

export function listTerminals(workspaceId: string): Promise<ListTerminalsResponse> {
  return request(`/w/${workspaceId}/terminals`);
}

export function deleteTerminal(workspaceId: string, id: string): Promise<void> {
  return request(`/w/${workspaceId}/terminals/${id}`, { method: "DELETE" });
}

export function updateTerminal(
  workspaceId: string,
  id: string,
  data: { tags?: string[] },
): Promise<{ terminal: import("@excaliterm/shared-types").TerminalSession }> {
  return request(`/w/${workspaceId}/terminals/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function closeAllTerminals(
  workspaceId: string,
): Promise<{ success: boolean; closed: number }> {
  return request(`/w/${workspaceId}/terminals`, { method: "DELETE" });
}

// ─── Canvas ────────────────────────────────────────────────────────────────

export function listCanvasNodes(workspaceId: string): Promise<ListCanvasNodesResponse> {
  return request(`/w/${workspaceId}/canvas/nodes`);
}

export function updateCanvasNode(
  workspaceId: string,
  id: string,
  data: UpdateCanvasNodeRequest,
): Promise<CanvasNode> {
  return request(`/w/${workspaceId}/canvas/nodes/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function deleteCanvasNode(workspaceId: string, id: string): Promise<void> {
  return request(`/w/${workspaceId}/canvas/nodes/${id}`, { method: "DELETE" });
}

// ─── Notes ─────────────────────────────────────────────────────────────────

export interface ListNotesResponse {
  notes: Array<{
    id: string;
    content: string;
    createdAt: string;
    updatedAt: string;
  }>;
}

export interface CreateNoteResponse {
  note: {
    id: string;
    content: string;
    createdAt: string;
    updatedAt: string;
  };
  canvasNode: import("@excaliterm/shared-types").CanvasNode;
}

export function listNotes(workspaceId: string): Promise<ListNotesResponse> {
  return request(`/w/${workspaceId}/notes`);
}

export function createNote(
  workspaceId: string,
  req: { content?: string; x?: number; y?: number } = {},
): Promise<CreateNoteResponse> {
  return request(`/w/${workspaceId}/notes`, {
    method: "POST",
    body: JSON.stringify(req),
  });
}

export function updateNote(
  workspaceId: string,
  id: string,
  content: string,
): Promise<{ note: { id: string; content: string } }> {
  return request(`/w/${workspaceId}/notes/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ content }),
  });
}

export function deleteNote(workspaceId: string, id: string): Promise<{ success: boolean }> {
  return request(`/w/${workspaceId}/notes/${id}`, { method: "DELETE" });
}

// ─── Services ─────────────────────────────────────────────────────────────────

export interface ServiceInstance {
  id: string;
  serviceId: string;
  name: string;
  whitelistedPaths: string | null;
  status: "online" | "offline";
  lastSeen: string | null;
  createdAt: string;
  updatedAt: string;
}

export function listServices(workspaceId: string): Promise<{ services: ServiceInstance[] }> {
  return request(`/w/${workspaceId}/services`);
}

export function createService(
  workspaceId: string,
  name: string,
): Promise<{ service: ServiceInstance }> {
  return request(`/w/${workspaceId}/services`, {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export function updateService(
  workspaceId: string,
  id: string,
  data: { name?: string; whitelistedPaths?: string },
): Promise<{ service: ServiceInstance }> {
  return request(`/w/${workspaceId}/services/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function deleteServiceApi(workspaceId: string, id: string): Promise<{ success: boolean }> {
  return request(`/w/${workspaceId}/services/${id}`, { method: "DELETE" });
}

// ─── Chat ─────────────────────────────────────────────────────────────────

export interface ChatHistoryResponse {
  messages: {
    id: string;
    displayName: string;
    content: string;
    createdAt: string;
  }[];
  limit: number;
  offset: number;
}

export function getChatHistory(
  workspaceId: string,
  limit = 50,
  offset = 0,
): Promise<ChatHistoryResponse> {
  return request(`/w/${workspaceId}/chat?limit=${limit}&offset=${offset}`);
}
