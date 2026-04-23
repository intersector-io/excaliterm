// ─── Terminal Hub ────────────────────────────────────────────────────────────

export interface CollaboratorIdentity {
  workspaceId: string;
  clientId: string;
  displayName: string;
}

export interface CollaboratorInfo {
  clientId: string;
  displayName: string;
  joinedAt: number;
}

export interface TerminalLockInfo {
  terminalId: string;
  clientId: string;
  displayName: string;
  lockedAt: number;
}

export interface CollaborationStateEvent {
  collaborators: CollaboratorInfo[];
  locks: TerminalLockInfo[];
}

export interface TerminalInputParams {
  terminalId: string;
  data: string;
}

export interface TerminalResizeParams {
  terminalId: string;
  cols: number;
  rows: number;
}

export interface TerminalOutputEvent {
  terminalId: string;
  data: string;
}

export interface TerminalCreatedEvent {
  terminalId: string;
}

export interface TerminalExitedEvent {
  terminalId: string;
  exitCode: number;
}

export interface TerminalDisconnectedEvent {
  terminalId: string;
}

export interface TerminalErrorEvent {
  terminalId: string;
  error: string;
}

export interface CollaboratorJoinedEvent {
  collaborator: CollaboratorInfo;
}

export interface CollaboratorLeftEvent {
  clientId: string;
}

export interface TerminalTypingEvent {
  terminalId: string;
  clientId: string;
  displayName: string;
  timestamp: number;
}

export interface TerminalLockChangedEvent {
  terminalId: string;
  lock: TerminalLockInfo | null;
}

// ─── Canvas Hub ──────────────────────────────────────────────────────────────

export interface CanvasNodeDto {
  id: string;
  terminalSessionId: string | null;
  userId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
}

export interface NodeAddedEvent {
  node: CanvasNodeDto;
}

export interface NodeMovedEvent {
  nodeId: string;
  x: number;
  y: number;
  userId: string;
}

export interface NodeResizedEvent {
  nodeId: string;
  width: number;
  height: number;
  userId: string;
}

export interface NodeRemovedEvent {
  nodeId: string;
  userId: string;
}

// ─── Chat Hub ────────────────────────────────────────────────────────────────

export interface ChatMessageDto {
  id: string;
  userId: string;
  userName: string;
  workspaceId: string;
  content: string;
  timestamp: number;
}

export interface SendMessageParams {
  content: string;
}

// ─── File Hub ────────────────────────────────────────────────────────────────

export interface ListDirectoryParams {
  serviceId: string;
  path: string;
}

export interface ReadFileParams {
  serviceId: string;
  path: string;
}

export interface WriteFileParams {
  serviceId: string;
  path: string;
  content: string;
}

/** Re-export FileEntry as FileEntryDto for SignalR protocol compatibility */
export type FileEntryDto = import("./models.js").FileEntry;

export interface DirectoryListingEvent {
  serviceId: string;
  path: string;
  entries: FileEntryDto[];
}

export interface FileContentEvent {
  serviceId: string;
  path: string;
  content: string;
}

export interface FileErrorEvent {
  serviceId: string;
  path: string;
  error: string;
}

// ─── Screen Share / Screenshot (via File Hub) ──────────────────────────────

export interface MonitorListingEvent {
  serviceId: string;
  monitors: import("./models.js").MonitorInfo[];
}

export interface ScreenshotCapturedEvent {
  serviceId: string;
  imageBase64: string;
  monitorIndex: number;
  width: number;
  height: number;
}

export interface WebRtcOfferEvent {
  serviceId: string;
  sessionId: string;
  sdp: string;
  type: string;
}

export interface WebRtcAnswerEvent {
  serviceId: string;
  sessionId: string;
  sdp: string;
  type: string;
}

export interface WebRtcIceCandidateEvent {
  serviceId: string;
  sessionId: string;
  candidate: string;
  sdpMid: string | null;
  sdpMLineIndex: number | null;
}

export interface ScreenShareSessionEvent {
  serviceId: string;
  sessionId: string;
  monitorIndex: number;
}

// ─── Shutdown ───────────────────────────────────────────────────────────────

export interface ShutdownInitiatedEvent {
  serviceId: string;
}

// ─── Hub Endpoints ───────────────────────────────────────────────────────────

export const HUB_ENDPOINTS = {
  terminal: "/hubs/terminal",
  canvas: "/hubs/canvas",
  chat: "/hubs/chat",
  file: "/hubs/file",
} as const;

// ─── Hub Method Names ────────────────────────────────────────────────────────

export const TerminalHubMethods = {
  // Client -> Server
  TerminalInput: "TerminalInput",
  TerminalResize: "TerminalResize",
  RequestCollaborationState: "RequestCollaborationState",
  AcquireTerminalLock: "AcquireTerminalLock",
  ReleaseTerminalLock: "ReleaseTerminalLock",
  ShutdownService: "ShutdownService",
  // Server -> Client
  TerminalOutput: "TerminalOutput",
  TerminalCreated: "TerminalCreated",
  TerminalExited: "TerminalExited",
  TerminalDisconnected: "TerminalDisconnected",
  TerminalError: "TerminalError",
  CollaborationState: "CollaborationState",
  CollaboratorJoined: "CollaboratorJoined",
  CollaboratorLeft: "CollaboratorLeft",
  TerminalTyping: "TerminalTyping",
  TerminalLockChanged: "TerminalLockChanged",
  ShutdownInitiated: "ShutdownInitiated",
  ServiceOnline: "ServiceOnline",
  ServiceOffline: "ServiceOffline",
  ServiceDeleted: "ServiceDeleted",
  // Server -> Service
  ShutdownHost: "ShutdownHost",
} as const;

export const CanvasHubMethods = {
  NodeAdded: "NodeAdded",
  NodeMoved: "NodeMoved",
  NodeResized: "NodeResized",
  NodeRemoved: "NodeRemoved",
} as const;

export const ChatHubMethods = {
  SendMessage: "SendMessage",
  ReceiveMessage: "ReceiveMessage",
} as const;

export const FileHubMethods = {
  // Client -> Server
  ListDirectory: "ListDirectory",
  ReadFile: "ReadFile",
  WriteFile: "WriteFile",
  ListMonitors: "ListMonitors",
  CaptureScreenshot: "CaptureScreenshot",
  StartScreenShare: "StartScreenShare",
  StopScreenShare: "StopScreenShare",
  ScreenShareAnswer: "ScreenShareAnswer",
  ScreenShareIceCandidate: "ScreenShareIceCandidate",
  // Server -> Client
  DirectoryListing: "DirectoryListing",
  FileContent: "FileContent",
  FileError: "FileError",
  MonitorListing: "MonitorListing",
  ScreenshotCaptured: "ScreenshotCaptured",
  ScreenShareOffer: "ScreenShareOffer",
  ScreenShareIceCandidateEvent: "ScreenShareIceCandidateEvent",
  ScreenShareSession: "ScreenShareSession",
} as const;
