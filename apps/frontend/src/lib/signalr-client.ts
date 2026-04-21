import {
  HubConnectionBuilder,
  HubConnection,
  HubConnectionState,
  LogLevel,
} from "@microsoft/signalr";
import type { CollaboratorProfile } from "@/lib/collaborator";

export type ConnectionStatus = "disconnected" | "connecting" | "connected" | "reconnecting";

type StatusChangeHandler = (hub: string, status: ConnectionStatus) => void;

const statusHandlers = new Set<StatusChangeHandler>();

function buildConnection(path: string, workspaceId: string, collaborator: CollaboratorProfile): HubConnection {
  const hubBase = import.meta.env.VITE_HUB_URL || window.location.origin;
  const url = new URL(path, hubBase);
  url.searchParams.set("workspaceId", workspaceId);
  url.searchParams.set("clientId", collaborator.clientId);
  url.searchParams.set("displayName", collaborator.displayName);
  return new HubConnectionBuilder()
    .withUrl(url.toString())
    .withAutomaticReconnect([0, 1000, 2000, 5000, 10000, 30000])
    .configureLogging(LogLevel.Warning)
    .build();
}

function attachStatusEvents(name: string, connection: HubConnection): void {
  connection.onreconnecting(() => {
    statusHandlers.forEach((h) => h(name, "reconnecting"));
  });

  connection.onreconnected(() => {
    statusHandlers.forEach((h) => h(name, "connected"));
  });

  connection.onclose(() => {
    statusHandlers.forEach((h) => h(name, "disconnected"));
  });
}

// Lazy hub connections — created per workspace
let _terminalHub: HubConnection | null = null;
let _canvasHub: HubConnection | null = null;
let _chatHub: HubConnection | null = null;
let _fileHub: HubConnection | null = null;
let _currentWorkspaceId: string | null = null;
let _currentCollaboratorKey: string | null = null;

export function getTerminalHub(): HubConnection {
  if (!_terminalHub) throw new Error("Hubs not initialized. Call initHubs() first.");
  return _terminalHub;
}

export function getCanvasHub(): HubConnection {
  if (!_canvasHub) throw new Error("Hubs not initialized. Call initHubs() first.");
  return _canvasHub;
}

export function getChatHub(): HubConnection {
  if (!_chatHub) throw new Error("Hubs not initialized. Call initHubs() first.");
  return _chatHub;
}

export function getFileHub(): HubConnection {
  if (!_fileHub) throw new Error("Hubs not initialized. Call initHubs() first.");
  return _fileHub;
}

export function initHubs(workspaceId: string, collaborator: CollaboratorProfile): void {
  const collaboratorKey = `${collaborator.clientId}:${collaborator.displayName}`;
  if (
    _currentWorkspaceId === workspaceId
    && _currentCollaboratorKey === collaboratorKey
    && _terminalHub
  ) {
    return;
  }

  // Destroy existing connections if workspace changed
  if (_terminalHub) {
    stopAll();
    destroyHubs();
  }

  _currentWorkspaceId = workspaceId;
  _currentCollaboratorKey = collaboratorKey;

  _terminalHub = buildConnection("/hubs/terminal", workspaceId, collaborator);
  _canvasHub = buildConnection("/hubs/canvas", workspaceId, collaborator);
  _chatHub = buildConnection("/hubs/chat", workspaceId, collaborator);
  _fileHub = buildConnection("/hubs/file", workspaceId, collaborator);

  attachStatusEvents("terminal", _terminalHub);
  attachStatusEvents("canvas", _canvasHub);
  attachStatusEvents("chat", _chatHub);
  attachStatusEvents("file", _fileHub);
}

export function onStatusChange(handler: StatusChangeHandler): () => void {
  statusHandlers.add(handler);
  return () => {
    statusHandlers.delete(handler);
  };
}

export function getConnectionStatus(connection: HubConnection): ConnectionStatus {
  switch (connection.state) {
    case HubConnectionState.Connected:
      return "connected";
    case HubConnectionState.Connecting:
      return "connecting";
    case HubConnectionState.Reconnecting:
      return "reconnecting";
    default:
      return "disconnected";
  }
}

export async function startAll(): Promise<void> {
  const connections = [
    { name: "terminal", conn: _terminalHub },
    { name: "canvas", conn: _canvasHub },
    { name: "chat", conn: _chatHub },
    { name: "file", conn: _fileHub },
  ];

  await Promise.allSettled(
    connections.map(async ({ name, conn }) => {
      if (!conn) return;
      if (conn.state === HubConnectionState.Disconnected) {
        statusHandlers.forEach((h) => h(name, "connecting"));
        try {
          await conn.start();
          statusHandlers.forEach((h) => h(name, "connected"));
        } catch (err) {
          console.error(`Failed to start ${name} hub:`, err);
          statusHandlers.forEach((h) => h(name, "disconnected"));
        }
      }
    }),
  );
}

export async function stopAll(): Promise<void> {
  await Promise.allSettled([
    _terminalHub?.stop(),
    _canvasHub?.stop(),
    _chatHub?.stop(),
    _fileHub?.stop(),
  ]);
}

export function destroyHubs(): void {
  _terminalHub = null;
  _canvasHub = null;
  _chatHub = null;
  _fileHub = null;
  _currentWorkspaceId = null;
  _currentCollaboratorKey = null;
}
