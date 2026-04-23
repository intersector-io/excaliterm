# Infrastructure — Technical

Cross-cutting concerns that power every feature: deployment topology, transport, persistence, authentication, and operational utilities.

## Deployment topology

`docker-compose.yml` at the repo root orchestrates four services:

| Service | Image / base | Port | Depends on |
|---|---|---|---|
| `redis` | `redis:7-alpine` | 6379 | — |
| `backend` | Node 22 / Hono | 3001 | `redis` (healthy) |
| `signalr-hub` | .NET 10 LTS | 5000 | `redis`, `backend` |
| `frontend` | Vite build served by Nginx | 5173 → 80 | `backend`, `signalr-hub` |

The backend mounts a `data` volume for the SQLite database. Health checks on each service gate startup ordering.

## Runtime layout

```
 Frontend (React/Vite) ── REST ─▶ Backend (Hono + Drizzle + SQLite)
         │                              │
         │                              └── Redis (pub/sub + buffer) ──┐
         └── SignalR (/hubs/terminal, /hubs/file, /hubs/chat, /hubs/canvas) ──▶ SignalR Hub (.NET)
                                                                                   ▲
                                                                         Terminal Agent (CLI)
                                                                         via SignalR (+ PTY, node-pty)
```

## REST transport — Hono

Base URL: `/api`. All workspace-scoped routes are mounted under `/api/w/:workspaceId/...` behind `workspaceMiddleware`. See [../api-reference.md](../api-reference.md) for a full endpoint list.

- CORS origin: `FRONTEND_URL`.
- Rate limiter: fixed-window, 100 requests per 60 s per IP (headers `X-RateLimit-Limit/Remaining/Reset`; 429 on exceed). IP is read from `x-forwarded-for` / `x-real-ip`. Implementation: `apps/backend/src/middleware/rate-limit.ts`.
- Health: `GET /api/health` returns `{ status, serviceConnected, connectedServices, timestamp }`.

## Realtime transport — SignalR (.NET)

Four hubs are registered (`apps/signalr-hub/Excaliterm.Hub/Hubs/`):

| Hub | Methods (selected) |
|---|---|
| `TerminalHub` | `TerminalInput`, `TerminalResize`, `AcquireTerminalLock`, `ReleaseTerminalLock`, `RequestTerminalBuffer`, `RegisterService` |
| `FileHub` | `ListDirectory`, `ReadFile`, `WriteFile`, `ListMonitors`, `CaptureScreenshot`, `StartScreenShare`, `StopScreenShare`, `ScreenShareAnswer`, `ScreenShareIceCandidate`, `RegisterService` |
| `ChatHub` | `SendMessage` |
| `CanvasHub` | `NodeAdded`, `NodeMoved`, `NodeResized`, `NodeRemoved` |

Authentication: services call `RegisterService(serviceId, apiKey)`; `ApiKeyValidator` calls back to the backend's `/api/validate-key` (cached 5 min) before accepting. Browser clients are not separately authenticated — they are scoped by workspace URL and their presence is ephemeral.

CORS origin: `Frontend:Url` (config).

## Redis — pub/sub and buffers

The hub uses Redis as a SignalR backplane (enabled when `REDIS_ENABLED=true` / `Redis:Enabled`). Channels:

| Channel | Direction | Payload |
|---|---|---|
| `terminal:commands` | backend → hub | `{ command: "terminal:create"/"destroy"/"resize"/"write", terminalId, serviceInstanceId, workspaceId, ... }` |
| `service:events` | hub → backend | `{ event: "online"/"offline", serviceInstanceId, workspaceId, timestamp }` |
| `canvas:updates` | backend → hub | `{ action: "nodeAdded"/"nodeMoved"/"nodeResized"/"nodeRemoved", workspaceId, userId, node?/nodeId?, x?, y?, width?, height? }` |
| `chat:messages` | backend → hub | `{ workspaceId, message: ChatMessageDto }` |

Redis list `terminal:buffer:{terminalId}` is an output ring buffer (capped at 1000 entries, 24 h TTL) used by `RequestTerminalBuffer` to replay output to reconnecting clients.

## Persistence — SQLite + Drizzle

Database file: `DATABASE_URL` (e.g. `/app/data/excaliterm.db`). `apps/backend/src/db/index.ts` opens the database with WAL enabled and foreign keys on, then runs idempotent CREATE TABLE statements for every table at startup. Inline `ALTER TABLE` migrations are wrapped in try/catch to be idempotent.

Tables: `workspace`, `service_instance`, `terminal_session`, `note`, `chat_message`, `screenshot`, `command_history`, `canvas_node`, `canvas_edge`. See each feature's technical doc for schema details.

## Authentication & authorization

- **Workspace API key** — auto-generated per workspace; shown in the Connect-a-Host dialog. Used by the terminal-agent CLI to authenticate SignalR hub connections.
- **Workspace URL** — anyone with the URL can join. There are no user accounts.
- **Service-side enforcement** — `ApiKeyValidator` (hub) + `WorkspaceValidator` (hub) both call back to the backend with a 5-minute cache and 10-second HTTP timeout. On backend failure they fail closed (returning false).
- **Path whitelist** — file hub enforces base paths `/app`, `/home`, `/var/log`. The agent enforces its own whitelist (from `WHITELISTED_PATHS`, `--allow <path>`, or positional args); the whitelist is empty by default, which blocks all filesystem access.

## Environment variables

### Backend

- `DATABASE_URL` (required)
- `FRONTEND_URL` (required, CORS)
- `BACKEND_PORT` (default `3001`)
- `REDIS_URL` (default `redis://localhost:6379`)

### SignalR hub

- `Frontend:Url` (CORS)
- `Backend:Url` (validation callback)
- `Redis:ConnectionString`
- `Redis:Enabled`

### Terminal agent CLI

- `SERVICE_API_KEY` (required)
- `SIGNALR_HUB_URL` (default `http://localhost:5000`)
- `WORKSPACE_ID` (required)
- `SHELL_OVERRIDE` (optional)
- `WHITELISTED_PATHS` (optional, comma-separated; also `--allow <path>` or positional args)
- `SERVICE_ID` (default `<hostname>-<pid>`)

## Terminal agent packaging

Published as `excaliterm` on npm (`apps/terminal-agent/package.json`).

- `bin`: `{ "excaliterm": "dist/index.js" }` (shebang in the compiled output).
- TypeScript compiled to `dist/` with ES2022 + ESNext modules, declarations, source maps.
- Engine: Node ≥20.12.
- Dependencies: `@microsoft/signalr`, `node-pty`, `screenshot-desktop`.
- Two hub connections (`TerminalHubConnection`, `FileHubConnection`) both use `.withAutomaticReconnect()` and re-invoke `RegisterService` on `onreconnected`.
- Graceful shutdown on SIGINT/SIGTERM (stops all PTYs and screen-share sessions).

## Logging & observability

- Backend: prefix-tagged `console.log`s (`[server]`, `[redis]`, `[db]`).
- Hub: `ILogger<T>` per class (Debug / Information / Warning / Error).
- No tracing or metrics pipeline ships with the project.

## Shared types

`packages/shared-types/` exports TypeScript models used across frontend, backend, and agent:

- `models.ts` — entities (TerminalSession, CanvasNode, CanvasEdge, ChatMessage, ...).
- `signalr.ts` — hub method names and DTOs, collaboration DTOs.
- `api.ts` — REST request/response shapes.

## Key files

- `docker-compose.yml`
- `apps/backend/src/index.ts` (bootstrapping, migrations, Redis subscribers)
- `apps/backend/src/db/`
- `apps/backend/src/middleware/` (workspace, rate-limit)
- `apps/signalr-hub/Excaliterm.Hub/Program.cs`
- `apps/signalr-hub/Excaliterm.Hub/Services/RedisSubscriber.cs`
- `apps/signalr-hub/Excaliterm.Hub/Auth/ApiKeyValidator.cs` / `WorkspaceValidator.cs`
- `apps/terminal-agent/src/index.ts` / `config.ts` / `hub/*`
- `packages/shared-types/src/`
