# Development Environment Setup

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | 20+ | Required for backend, frontend, and terminal agent |
| pnpm | 10+ | Root `packageManager` is `pnpm@10.33.0` |
| .NET SDK | 8+ | Required for the SignalR hub |
| Redis | 7+ | Required by the backend and by the hub for command/event fanout |
| Docker | Optional | Useful for Redis or the full containerized stack |

## Install Dependencies

```bash
pnpm install
cp .env.example .env
```

## Environment Variables

The root `.env` file is consumed by the backend and terminal agent. The SignalR hub uses `appsettings.json` by default, but can also read environment variables when you run it through your shell or Docker.

### Backend and frontend-facing settings

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | SQLite path for the backend |
| `FRONTEND_URL` | Yes | Frontend origin allowed by backend CORS |
| `BACKEND_PORT` | Yes | Backend listen port |
| `REDIS_URL` | Yes | Redis URL used by the backend |

### Terminal agent settings

| Variable | Required | Description |
|----------|----------|-------------|
| `SIGNALR_HUB_URL` | Yes | Base URL for the SignalR hub |
| `SERVICE_API_KEY` | Yes | Shared secret accepted by the SignalR hub |
| `SERVICE_ID` | Recommended | Stable identifier for this agent instance |
| `TENANT_ID` | Required for useful terminal work | Workspace ID the agent should join |
| `WHITELISTED_PATHS` | Optional | Comma-separated filesystem roots allowed by the agent |
| `SHELL_OVERRIDE` | Optional | Shell executable to launch instead of the default |

Important:

- `TENANT_ID` should be the same value as the workspace ID in the browser URL.
- The backend uses `workspaceId` while the hub and agent use `tenantId`; they are the same logical ID.
- On Windows, the default shell is `powershell.exe -NoLogo -NoProfile` so the web terminal does not inherit local prompt themes.

### SignalR hub settings

The hub reads defaults from `apps/signalr-hub/TerminalProxy.Hub/appsettings.json`.

For local development, you usually need these overrides:

| Variable | Example | Purpose |
|----------|---------|---------|
| `REDIS_ENABLED` | `true` | Enables Redis subscriptions in the hub |
| `REDIS_CONNECTION_STRING` | `localhost:6379` | StackExchange.Redis connection string |
| `BACKEND_URL` | `http://localhost:3001` | Used for workspace validation |
| `FRONTEND_URL` | `http://localhost:5173` | Used by hub CORS |

## Recommended Local Startup Sequence

### 1. Start Redis

```bash
docker compose up redis -d
```

If you already run Redis locally, use that instead.

### 2. Start the backend

```bash
pnpm --filter @terminal-proxy/backend dev
```

### 3. Start the SignalR hub with Redis enabled

PowerShell:

```powershell
$env:REDIS_ENABLED = "true"
$env:REDIS_CONNECTION_STRING = "localhost:6379"
$env:BACKEND_URL = "http://localhost:3001"
$env:FRONTEND_URL = "http://localhost:5173"
dotnet run --project apps/signalr-hub/TerminalProxy.Hub
```

Bash:

```bash
REDIS_ENABLED=true \
REDIS_CONNECTION_STRING=localhost:6379 \
BACKEND_URL=http://localhost:3001 \
FRONTEND_URL=http://localhost:5173 \
dotnet run --project apps/signalr-hub/TerminalProxy.Hub
```

### 4. Start the frontend

```bash
pnpm --filter @terminal-proxy/frontend dev
```

### 5. Create or open a workspace

Open `http://localhost:5173`. The app will create a workspace automatically and redirect you to:

```text
/w/<workspaceId>
```

Copy that workspace ID from the URL.

### 6. Start the terminal agent for that workspace

PowerShell:

```powershell
$env:TENANT_ID = "<workspaceId>"
pnpm --filter @terminal-proxy/terminal-agent dev
```

Bash:

```bash
TENANT_ID=<workspaceId> pnpm --filter @terminal-proxy/terminal-agent dev
```

At this point:

- `GET /api/health` should report at least one connected service
- creating a terminal in the UI should produce a live shell
- file operations and chat should use the same workspace

## Using `pnpm dev`

`pnpm dev` runs the JavaScript workspaces managed by Turbo:

- `@terminal-proxy/backend`
- `@terminal-proxy/frontend`
- `@terminal-proxy/terminal-agent`

The .NET SignalR hub is not part of the pnpm workspace and must still be started separately.

On a fresh setup, running each component individually is easier because the terminal agent needs a real `TENANT_ID` and the hub must have Redis enabled before terminal creation works.

## Docker Compose

```bash
docker compose up --build
```

This brings up:

- `redis`
- `backend`
- `signalr-hub`
- `frontend`

The terminal agent still runs separately on a host machine or VM. Configure it with:

- `SIGNALR_HUB_URL` pointing at the deployed hub
- `SERVICE_API_KEY` matching the hub configuration
- `TENANT_ID` matching the target workspace

## Verification Checklist

1. Open `http://localhost:5173`.
2. Confirm the URL contains `/w/<workspaceId>`.
3. Call `http://localhost:3001/api/health` and confirm `status: "ok"`.
4. Start the terminal agent with that workspace ID.
5. Refresh the health endpoint and confirm `serviceConnected: true`.
6. Create a terminal and confirm output appears.
