# SignalR Protocol

The current realtime layer is SignalR, not raw `/ws/client` and `/ws/service` sockets.

## Hub Endpoints

| Hub | Endpoint | Used by |
|-----|----------|---------|
| TerminalHub | `/hubs/terminal` | browsers and terminal agent |
| CanvasHub | `/hubs/canvas` | browsers |
| ChatHub | `/hubs/chat` | browsers |
| FileHub | `/hubs/file` | browsers and terminal agent |

## Connection Model

### Browser clients

Browser clients connect with query parameters:

- `workspaceId`
- `clientId`
- `displayName`

The hub validates `workspaceId` by calling the backend and then adds the connection to the workspace group.

### Service clients

The terminal agent connects with query parameters:

- `apiKey`
- `tenantId`

After the SignalR connection is established, the agent calls `RegisterService(serviceId, apiKey)` on the terminal and file hubs.

`tenantId` is the same logical value as `workspaceId`.

## Terminal Hub

### Browser -> hub methods

| Method | Arguments | Purpose |
|--------|-----------|---------|
| `RequestCollaborationState` | none | Fetch current collaborator and lock state |
| `AcquireTerminalLock` | `terminalId` | Lock a terminal for one collaborator |
| `ReleaseTerminalLock` | `terminalId` | Release a terminal lock |
| `TerminalInput` | `terminalId`, `data` | Send terminal input to the owning agent |
| `TerminalResize` | `terminalId`, `cols`, `rows` | Resize a terminal |
| `RequestTerminalBuffer` | `terminalId` | Replay buffered output when Redis buffering is enabled |

`data` is plain text in the current implementation, not base64.

### Agent -> hub methods

| Method | Arguments | Purpose |
|--------|-----------|---------|
| `RegisterService` | `serviceId`, `apiKey` | Register the agent connection |
| `TerminalCreated` | `terminalId` | Report that a terminal started successfully |
| `TerminalOutput` | `terminalId`, `data` | Stream terminal output |
| `TerminalExited` | `terminalId`, `exitCode` | Report process exit |
| `TerminalError` | `terminalId`, `error` | Report terminal-level errors |

### Hub -> browser events

| Event | Payload |
|-------|---------|
| `CollaborationState` | `{ collaborators, locks }` |
| `CollaboratorJoined` | `{ collaborator }` |
| `CollaboratorLeft` | `{ clientId }` |
| `TerminalTyping` | `{ terminalId, clientId, displayName, timestamp }` |
| `TerminalLockChanged` | `{ terminalId, lock }` |
| `TerminalCreated` | `{ terminalId }` |
| `TerminalOutput` | `{ terminalId, data }` |
| `TerminalExited` | `{ terminalId, exitCode }` |
| `TerminalDisconnected` | `{ terminalId }` |
| `TerminalError` | `{ terminalId, error }` |
| `ServiceOnline` | `serviceId` |
| `ServiceOffline` | `serviceId` |

### Hub -> agent events

| Event | Arguments |
|-------|-----------|
| `CreateTerminal` | `terminalId`, `cols`, `rows` |
| `DestroyTerminal` | `terminalId` |
| `TerminalInput` | `terminalId`, `data` |
| `TerminalResize` | `terminalId`, `cols`, `rows` |

### Terminal routing

Terminal creation does not originate in the hub. The path is:

1. Backend receives `POST /api/w/:workspaceId/terminals`
2. Backend publishes a Redis message on `terminal:commands`
3. The hub consumes that command and sends `CreateTerminal` to the target service

When Redis is disabled in the hub, this flow breaks even if the browser can still connect to SignalR.

## Canvas Hub

### Browser -> hub methods

| Method | Arguments |
|--------|-----------|
| `NodeAdded` | `node` |
| `NodeMoved` | `nodeId`, `x`, `y` |
| `NodeResized` | `nodeId`, `width`, `height` |
| `NodeRemoved` | `nodeId` |

### Hub -> browser events

| Event | Payload |
|-------|---------|
| `NodeAdded` | `{ node, userId }` |
| `NodeMoved` | `{ nodeId, x, y, userId }` |
| `NodeResized` | `{ nodeId, width, height, userId }` |
| `NodeRemoved` | `{ nodeId, userId }` |

## Chat Hub

### Browser -> hub methods

| Method | Arguments |
|--------|-----------|
| `SendMessage` | `content` |

### Hub -> browser events

| Event | Payload |
|-------|---------|
| `ReceiveMessage` | `{ id, userId, userName, tenantId, content, timestamp }` |

Chat history is still fetched from the backend through REST. The hub only handles live delivery.

## File Hub

### Browser -> hub methods

The hub methods are defined as positional arguments:

| Method | Arguments |
|--------|-----------|
| `ListDirectory` | `serviceId`, `path` |
| `ReadFile` | `serviceId`, `path` |
| `WriteFile` | `serviceId`, `path`, `content` |

### Agent -> hub methods

| Method | Arguments |
|--------|-----------|
| `RegisterService` | `serviceId`, `apiKey` |
| `DirectoryListingResponse` | `callerConnectionId`, `listing` |
| `FileContentResponse` | `callerConnectionId`, `content` |
| `FileErrorResponse` | `callerConnectionId`, `error` |

### Hub -> browser events

| Event | Payload |
|-------|---------|
| `DirectoryListing` | `{ serviceId, path, entries }` |
| `FileContent` | `{ serviceId, path, content }` |
| `FileError` | `{ serviceId, path, error }` |

### Hub -> agent events

| Event | Arguments |
|-------|-----------|
| `ListDirectory` | `callerConnectionId`, `serviceId`, `path` |
| `ReadFile` | `callerConnectionId`, `serviceId`, `path` |
| `WriteFile` | `callerConnectionId`, `serviceId`, `path`, `content` |

### File access checks

There are two layers of path enforcement:

1. The hub rejects paths outside its built-in allowlist before forwarding.
2. The terminal agent enforces `WHITELISTED_PATHS` again on the host.

The REST files route is still a stub, so the file hub is the active protocol for live file access.

## Redis-backed Fanout

When Redis is enabled in the hub, it subscribes to:

- `terminal:commands`
- `canvas:updates`
- `chat:messages`

The backend separately subscribes to `service:events` to keep service status in sync with agent presence.
