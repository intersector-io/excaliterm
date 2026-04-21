# Excaliterm

Collaborative terminal workspace with an infinite canvas UI, shared notes, chat, and file access.

## Architecture

```text
+-----------+     REST      +-----------+     Redis      +-------------+
| Frontend  | <-----------> | Backend   | <-----------> | SignalR Hub |
| React/Vite|               | Hono/TS   |               | .NET 8      |
+-----------+               +-----------+               +-------------+
      ^                           ^                            ^
      | SignalR (/hubs/*)         | SQLite                     | SignalR
      |                           |                            |
      +---------------------------+----------------------------+
                                  |
                           +-------------+
                           | terminal-   |
                           | agent       |
                           | node-pty    |
                           +-------------+
```

## Stack

- Frontend: React 19, Vite 6, Tailwind CSS 4, `@xyflow/react`, xterm.js, TanStack Query, Zustand, SignalR
- Backend: Hono, TypeScript, Drizzle ORM, SQLite, Redis
- Realtime hub: ASP.NET Core SignalR on .NET 8
- Agent: Node.js, `node-pty`, SignalR client
- Tooling: pnpm workspaces, Turborepo, Docker Compose

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm 10+
- .NET 8 SDK
- Redis 7+

### Install

```bash
pnpm install
cp .env.example .env
```

Set at least these values in `.env`:

- `DATABASE_URL`
- `FRONTEND_URL`
- `BACKEND_PORT`
- `REDIS_URL`
- `SIGNALR_HUB_URL`
- `SERVICE_API_KEY`

### Local Development

Start Redis first, then run the backend and frontend:

```bash
docker compose up redis -d
pnpm --filter @terminal-proxy/backend dev
pnpm --filter @terminal-proxy/frontend dev
```

Run the SignalR hub with Redis enabled. In PowerShell:

```powershell
$env:REDIS_ENABLED = "true"
$env:REDIS_CONNECTION_STRING = "localhost:6379"
dotnet run --project apps/signalr-hub/TerminalProxy.Hub
```

Then:

1. Open `http://localhost:5173`.
2. The app creates or restores a workspace and redirects to `/w/<workspaceId>`.
3. Copy that workspace ID from the URL.
4. Start the terminal agent with `TENANT_ID=<workspaceId>`.

PowerShell example:

```powershell
$env:TENANT_ID = "<workspaceId>"
pnpm --filter @terminal-proxy/terminal-agent dev
```

Once your env is already configured, `pnpm dev` can be used to launch the JavaScript workspaces together. The .NET SignalR hub still runs separately.

### Docker

```bash
docker compose up --build
```

This starts `redis`, `backend`, `signalr-hub`, and `frontend`. The terminal agent still runs outside Docker and connects to the hub with the same `SERVICE_API_KEY` and a `TENANT_ID` matching the target workspace.

### Tests

```bash
pnpm test
pnpm --filter @terminal-proxy/backend test
pnpm --filter @terminal-proxy/frontend test
dotnet build apps/signalr-hub/TerminalProxy.Hub
```

## Documentation

- [Architecture](./docs/architecture.md)
- [Setup Guide](./docs/setup.md)
- [API Reference](./docs/api-reference.md)
- [SignalR Protocol](./docs/websocket-protocol.md)
- [Development Guide](./docs/development.md)
- [Terminal Agent Guide](./docs/windows-service.md)
- [Deployment](./docs/deployment.md)

## License

Private
