# Excaliterm

Collaborative terminal workspace with an infinite canvas UI, shared notes, chat, and file access.

[excaliterm.com](https://excaliterm.com) | [npm](https://www.npmjs.com/package/excaliterm)

## Screenshots

### Desktop

Infinite canvas with live terminals, sticky notes, and tag-based organization:

![Desktop canvas with terminals and tags](screenshots/after-05-terminal-tags-row.png)

Pinned sidebar for quick navigation between Canvas, Editor, Chat, Services, and Settings:

![Desktop sidebar expanded](screenshots/after-02-desktop-sidebar-pinned.png)

Command palette for keyboard-driven workflows:

![Command palette](screenshots/after-03-command-palette.png)

### Mobile

Terminal list with live status indicators and one-tap access:

<p>
  <img src="screenshots/after-04-mobile-terminal-list.png" alt="Mobile terminal list" width="300">
</p>

Fullscreen terminal with swipe navigation between sessions:

<p>
  <img src="screenshots/14-mobile-terminal-fullscreen.png" alt="Mobile fullscreen terminal" width="300">
</p>

## Getting Started

### 1. Create a workspace

Go to [excaliterm.com](https://excaliterm.com) -- a workspace is created automatically. Copy the **workspace ID** from the URL (`/w/<id>`).

### 2. Register a service

In the sidebar, open the **Services** tab and click **Register Service**. Give it a name (e.g. "My Laptop"). Copy the **API key** and **hub URL** from the config that appears.

### 3. Install the CLI

```bash
npm install -g excaliterm
```

Requires [Node.js](https://nodejs.org/) 18 or later.

### 4. Connect your machine

Set the environment variables from the previous steps and run the CLI:

**Linux / macOS:**

```bash
export SIGNALR_HUB_URL="<hub URL from service config>"
export SERVICE_API_KEY="<API key from service config>"
export WORKSPACE_ID="<workspace ID from URL>"
excaliterm
```

**Windows (PowerShell):**

```powershell
$env:SIGNALR_HUB_URL = "<hub URL from service config>"
$env:SERVICE_API_KEY = "<API key from service config>"
$env:WORKSPACE_ID = "<workspace ID from URL>"
excaliterm
```

Once the agent logs `Ready and waiting for commands`, the UI shows **"1 host ready"** -- your machine is connected.

### 5. Create terminals

Click the **Terminal** button in the canvas toolbar. A live shell session appears on the canvas. Create as many as you need -- they arrange in a grid automatically. Tag them, filter by tag, drag them around, resize, and collaborate in real-time.

### 6. Share with others

Copy the workspace URL and send it to anyone. They join instantly as a collaborator -- no accounts needed.

## CLI Reference

| Environment Variable | Required | Default | Description |
|---|---|---|---|
| `SERVICE_API_KEY` | Yes | -- | API key from the service registration step |
| `SIGNALR_HUB_URL` | Yes | `http://localhost:5000` | SignalR hub URL from the service config |
| `WORKSPACE_ID` | Yes | -- | Workspace ID from the browser URL |
| `SHELL_OVERRIDE` | No | Auto-detected | Override the default shell (e.g. `/bin/zsh`, `bash.exe`) |
| `WHITELISTED_PATHS` | No | -- | Comma-separated list of allowed working directories |
| `SERVICE_ID` | No | `<hostname>-<pid>` | Custom identifier for this agent instance |

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

## Self-Hosting

### Docker

```bash
docker compose up --build -d
```

This starts four containers: Redis, Backend API, SignalR Hub, and Frontend. Open **http://localhost:5173** -- a workspace is created automatically. Then follow steps 2-6 above, using `http://localhost:5000` as the hub URL and the `SERVICE_API_KEY` from your `.env` file.

## Local Development

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
