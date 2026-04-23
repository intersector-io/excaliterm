# Architecture

## Overview

The current system is workspace-based rather than user-session-based. A browser client opens a workspace, connects to SignalR hubs using that workspace ID, and collaborates with other clients in the same workspace. Terminal processes and file operations are executed by `apps/terminal-agent`, while the backend persists workspace state in SQLite and uses Redis to coordinate with the SignalR hub.

`workspaceId` is used consistently across the REST API, frontend, SignalR hub, and terminal agent.

## Components

### Frontend (`apps/frontend`)

The frontend is a React SPA served by Vite in development and nginx in production. It creates or restores a workspace, stores the workspace ID locally, and routes users to `/w/:workspaceId`.

Key responsibilities:

- Create and validate workspaces
- Render the infinite canvas with terminal, note, host, editor, screenshot, and screen-share nodes
- Open SignalR connections to terminal, canvas, chat, and file hubs
- Drive terminal I/O, collaboration locks, chat, and file editing
- On mobile (<=767px): render a dedicated mobile experience with hosts section, terminal list with tag-colored cards, notes section, media viewer, full-screen chat, virtual keyboard bar, scroll buttons, flippable terminal info card, and fullscreen file editor
- On desktop: auto-layout canvas nodes using dagre, split terminal view (horizontal/vertical/quad)

### Backend (`apps/backend`)

The backend is a Hono app that owns the REST API and SQLite state. It validates workspace-scoped requests, persists terminals, notes, canvas nodes, service instances, and chat history, and publishes realtime commands and events through Redis.

Key responsibilities:

- Create and validate workspaces
- Persist canvas, note, service, terminal, and chat data
- Select an online service when a terminal is created
- Publish terminal commands to Redis
- Subscribe to service presence events from Redis and update service status

### SignalR Hub (`apps/signalr-hub/Excaliterm.Hub`)

The hub is the realtime transport layer. Browser clients connect to `/hubs/terminal`, `/hubs/canvas`, `/hubs/chat`, and `/hubs/file`. The terminal agent connects to the terminal and file hubs as a service client.

Key responsibilities:

- Validate browser workspace access on connect
- Group clients by workspace
- Route terminal input to the correct service connection
- Relay terminal output and lifecycle events back to browsers
- Coordinate collaboration presence and terminal locks
- Relay file requests between browsers and the terminal agent
- Subscribe to Redis channels for backend-driven terminal, canvas, and chat events

### Terminal Agent (`apps/terminal-agent`)

The terminal agent is a Node.js process that owns shell processes through `node-pty` and serves file operations through the file hub. It is the runtime that actually launches terminals.

Key responsibilities:

- Connect to SignalR with the workspace API key, `SERVICE_ID`, and `WORKSPACE_ID`
- Create, resize, write to, and destroy terminal sessions
- Stream terminal output back to the hub
- Read and write files within its configured whitelist

### Redis

Redis is the bridge between the backend and the SignalR hub.

Channels currently used:

- `terminal:commands`
- `canvas:updates`
- `chat:messages`
- `service:events`

If Redis is not available, terminal creation and backend-driven fanout will not work correctly.

## Request and Realtime Flow

### Workspace bootstrap

1. The browser loads `/`.
2. The frontend creates a workspace with `POST /api/workspaces` or restores the last known workspace.
3. The browser is redirected to `/w/:workspaceId`.
4. The frontend initializes SignalR hub connections with `workspaceId`, `clientId`, and `displayName`.

### Terminal lifecycle

1. The frontend calls `POST /api/w/:workspaceId/terminals`.
2. The backend picks an online service for that workspace, inserts `terminal_session` and `canvas_node`, and publishes `terminal:create` to Redis.
3. The SignalR hub consumes the Redis message and forwards `CreateTerminal` to the terminal agent.
4. The agent launches the PTY, then reports `TerminalCreated` and later `TerminalOutput`, `TerminalExited`, or `TerminalError`.
5. The hub broadcasts those events to browsers in the same workspace.

### Canvas and notes

- REST owns persistence for canvas nodes and notes.
- SignalR is used for collaboration events such as `NodeMoved` and `NodeResized`.
- Notes are stored separately and linked to canvas nodes through `noteId`.

### Command history

- The frontend tracks keystrokes in each terminal and detects commands when Enter is pressed.
- Commands are persisted to the `command_history` table via the REST API.
- A `command-history` canvas node can be created from a terminal's dropdown menu to display the history and top 10 most-used commands.
- Each command row has copy and execute buttons. Execute re-sends the command to the linked terminal via SignalR.

### Terminal discovery

- **Desktop**: A collapsible Terminal Dock sits at the bottom of the canvas. It shows miniature skeleton cards for each terminal, grouped by tag or host. A search input filters by terminal ID or tag. Clicking a skeleton pans the canvas to the terminal node; double-clicking opens fullscreen.
- **Mobile**: The terminal list view supports grouping by status, tag, or host via a dropdown toggle. Fullscreen cycling supports swipe gestures for navigating between terminals.
- Grouping logic is shared between desktop and mobile via `src/lib/terminal-grouping.ts`.

### Chat

- Chat history is stored in SQLite and retrieved through REST.
- New chat messages are broadcast through the SignalR chat hub.

### Files

- The REST files route is currently only a placeholder.
- Interactive file operations go through the SignalR file hub.
- The hub applies a path allowlist before relaying to the terminal agent.
- The terminal agent applies its own whitelist again before touching the filesystem.

## Data Model

The backend schema lives in `apps/backend/src/db/schema.ts`.

### `workspace`

Root entity for collaboration. A workspace acts as the access boundary for nearly every API route and SignalR group.

Fields:

- `id`
- `name`
- `apiKey` -- auto-generated per workspace, used to authenticate terminal agents
- `createdAt`
- `lastAccessedAt`

### `service_instance`

Represents a service/agent entry associated with a workspace.

Fields:

- `id`
- `workspaceId`
- `serviceId`
- `name`
- `apiKey`
- `whitelistedPaths`
- `lastSeen`
- `status`
- `createdAt`
- `updatedAt`

### `terminal_session`

Tracks a terminal owned by a workspace and optionally linked to a specific service instance.

Fields:

- `id`
- `workspaceId`
- `serviceInstanceId`
- `status`
- `exitCode`
- `createdAt`
- `updatedAt`

### `canvas_node`

Stores layout data for terminals and notes on the infinite canvas.

Fields:

- `id`
- `workspaceId`
- `terminalSessionId`
- `nodeType`
- `noteId`
- `x`
- `y`
- `width`
- `height`
- `zIndex`
- `createdAt`
- `updatedAt`

### `note`

Stores note content that can be attached to a canvas node.

Fields:

- `id`
- `workspaceId`
- `content`
- `createdAt`
- `updatedAt`

### `chat_message`

Stores chat history for a workspace.

Fields:

- `id`
- `workspaceId`
- `displayName`
- `content`
- `createdAt`

### `command_history`

Stores commands entered in terminal sessions. Tracked on the frontend by buffering keystrokes and detecting Enter.

Fields:

- `id`
- `workspaceId`
- `terminalSessionId`
- `command`
- `executedAt`
- `createdAt`

## Relationships

```text
workspace 1--* service_instance
workspace 1--* terminal_session
workspace 1--* canvas_node
workspace 1--* note
workspace 1--* chat_message
workspace 1--* command_history

service_instance 1--* terminal_session
terminal_session 1--0..1 canvas_node
terminal_session 1--* command_history
note 1--0..1 canvas_node
```

## Agent Discovery

The frontend serves several static files and nginx configuration for AI agent discoverability:

- `/robots.txt` and `/sitemap.xml` for crawlers
- `/.well-known/api-catalog` (`application/linkset+json`) for API discovery per RFC 9727
- `/.well-known/mcp/server-card.json` for MCP server metadata
- `/.well-known/agent-skills/index.json` with skill definitions for workspace and terminal management
- `Link` response headers on all pages pointing to the API catalog and health endpoint
- Content negotiation: requests with `Accept: text/markdown` on the homepage return a markdown representation instead of the SPA HTML
- WebMCP tools registered via `navigator.modelContext` for browser-based AI agents (create-workspace, get-workspace, list-terminals, health-check)
- Cloudflare Pages `_headers` file for production Link header and Content-Type enforcement

## Current Constraints

- Browser access is workspace-link-based today. The old Better Auth flow is not part of the active architecture.
- The file REST route is a stub; live file operations happen over SignalR.
