# Excaliterm

Collaborative terminal workspace with an infinite canvas UI, shared notes, chat, and file access.

## Architecture

```text
+-----------+     REST      +-----------+     Redis      +-------------+
| Frontend  | <-----------> | Backend   | <-----------> | SignalR Hub |
| React/Vite|               | Hono/TS   |               | .NET 10     |
+-----------+               +-----------+               +-------------+
      ^                           ^                            ^
      | SignalR (/hubs/*)         | SQLite                     | SignalR
      |                           |                            |
      +---------------------------+----------------------------+
                                  |
                           +-------------+
                           | excaliterm  |
                           | CLI agent   |
                           | node-pty    |
                           +-------------+
```

## Stack

- Frontend: React 19, Vite 6, Tailwind CSS 4, `@xyflow/react`, xterm.js, TanStack Query, Zustand, SignalR
- Backend: Hono, TypeScript, Drizzle ORM, SQLite, Redis
- Realtime hub: ASP.NET Core SignalR on .NET 10 LTS
- Agent: Node.js, `node-pty`, SignalR client (`npm install -g excaliterm`)
- Tooling: pnpm workspaces, Turborepo, Docker Compose

## Getting Started

### 1. Start the platform

```bash
docker compose up --build -d
```

This starts four containers: Redis, Backend API, SignalR Hub, and Frontend. Open **http://localhost:5173** in your browser -- a workspace is created automatically.

### 2. Register a service

In the web UI, go to the **Services** tab and click **Register Service**. Give it a name (e.g. "My Laptop"). Copy the config that appears.

### 3. Connect your machine

Install the CLI agent globally:

```bash
npm install -g excaliterm
```

Set the environment variables from the service config and the workspace ID from the browser URL (`/w/<id>`):

```bash
export SIGNALR_HUB_URL="http://localhost:5000"
export SERVICE_API_KEY="<key from your .env>"
export WORKSPACE_ID="<id from URL>"
excaliterm
```

Once the agent logs `Ready and waiting for commands`, the UI shows **"1 host ready"**.

### 4. Create terminals

Click the **Terminal** button in the canvas toolbar. A live shell session appears on the canvas. Create as many as you need -- they arrange in a grid automatically. Tag them, filter by tag, drag them around, resize, and collaborate in real-time.

### 5. Share with others

Copy the workspace URL and send it to anyone. They join instantly as a collaborator -- no accounts needed.

## Quick Start (Local Development)

### Prerequisites

- Node.js 22+
- pnpm 10+
- .NET 10 SDK
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

### Run

Start Redis first, then run the backend and frontend:

```bash
docker compose up redis -d
pnpm --filter @excaliterm/backend dev
pnpm --filter @excaliterm/frontend dev
```

Run the SignalR hub with Redis enabled. In PowerShell:

```powershell
$env:REDIS_ENABLED = "true"
$env:REDIS_CONNECTION_STRING = "localhost:6379"
dotnet run --project apps/signalr-hub/Excaliterm.Hub
```

Then:

1. Open `http://localhost:5173`.
2. The app creates or restores a workspace and redirects to `/w/<workspaceId>`.
3. Copy that workspace ID from the URL.
4. Start the terminal agent with `WORKSPACE_ID=<workspaceId>`.

PowerShell example:

```powershell
$env:WORKSPACE_ID = "<workspaceId>"
pnpm --filter @excaliterm/terminal-agent dev
```

Once your env is already configured, `pnpm dev` can be used to launch the JavaScript workspaces together. The .NET SignalR hub still runs separately.

### Docker

```bash
docker compose up --build
```

This starts `redis`, `backend`, `signalr-hub`, and `frontend`. The terminal agent still runs outside Docker and connects to the hub with the same `SERVICE_API_KEY` and a `WORKSPACE_ID` matching the target workspace.

### Tests

```bash
pnpm test
pnpm --filter @excaliterm/backend test
pnpm --filter @excaliterm/frontend test
dotnet build apps/signalr-hub/Excaliterm.Hub
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

MIT
