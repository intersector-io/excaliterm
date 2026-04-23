# Excaliterm

Collaborative terminal workspace with an infinite canvas UI, shared notes, chat, and file access.

[excaliterm.com](https://excaliterm.com) | [npm](https://www.npmjs.com/package/excaliterm)

## Screenshots

### Desktop

Infinite canvas with live terminals, sticky notes, and a connected host:

![Desktop canvas with terminals, notes, and host](screenshots/hero-canvas.png)

### Mobile

Full mobile experience with hosts, terminals, notes, media, and chat:

<p>
  <img src="screenshots/after-04-mobile-terminal-list.png" alt="Mobile terminal list" width="300">
</p>

Fullscreen terminal with virtual keyboard bar, scroll buttons, and flippable info panel:

<p>
  <img src="screenshots/14-mobile-terminal-fullscreen.png" alt="Mobile fullscreen terminal" width="300">
</p>

## Getting Started

### 1. Create a workspace

Go to [excaliterm.com](https://excaliterm.com) -- a workspace is created automatically. Copy the **workspace ID** from the URL (`/w/<id>`).

### 2. Connect a host

In the canvas toolbar, click **Connect a Host**. The dialog shows the full connection command with the workspace API key and hub URL pre-filled. Copy it.

### 3. Install the CLI

```bash
npm install -g excaliterm
```

Requires [Node.js](https://nodejs.org/) 20.12 or later.

### 4. Connect your machine

Paste the command from the "Connect a Host" dialog, or set the environment variables manually:

**Linux / macOS:**

```bash
export SIGNALR_HUB_URL="https://hub.excaliterm.com"
export SERVICE_API_KEY="<workspace API key>"
export WORKSPACE_ID="<workspace ID from URL>"
excaliterm
```

**Windows (PowerShell):**

```powershell
$env:SIGNALR_HUB_URL = "https://hub.excaliterm.com"
$env:SERVICE_API_KEY = "<workspace API key>"
$env:WORKSPACE_ID = "<workspace ID from URL>"
excaliterm
```

The API key is auto-generated per workspace. You can find it any time in the "Connect a Host" dialog.

Once the agent logs `Ready and waiting for commands`, the UI shows **"1 host ready"** -- your machine is connected.

### 5. Create terminals and editors

Click the **Terminal** or **Editor** button on the host node in the canvas. A live shell session or file editor appears on the canvas, linked to the host. Create as many as you need -- they arrange in a grid automatically. Tag terminals, filter by tag, drag them around, resize, and collaborate in real-time.

### 6. Find terminals with the dock

The **Terminal Dock** at the bottom of the canvas shows miniature skeleton cards for every terminal, grouped by **tag** or **host**. Use the search input to filter by ID or tag. Click a skeleton to pan to it on the canvas, or double-click to open fullscreen. On mobile, switch the terminal list grouping between status, tag, or host with the group toggle button. Swipe left/right in fullscreen to cycle between terminals.

### Mobile-specific features

On mobile (<=767px), the app switches to a dedicated mobile experience:

- **Hosts section** -- see connected hosts with status and quick-action buttons (new terminal, open editor)
- **Terminal cards with tag colors** -- colored left borders derived from the first tag for visual identification
- **Notes section** -- create and edit sticky notes with a fullscreen markdown editor
- **Chat as a full view** -- tap the Chat tab in the bottom nav for a full-screen chat experience
- **Virtual keyboard bar** -- two-row grid with ESC, TAB, CTRL (toggle modifier), pipe, tilde, arrow keys, and speech-to-text mic button
- **Scroll buttons** -- floating scroll-up/scroll-down buttons in fullscreen terminal mode
- **Flippable card** -- tap the rotate icon in the terminal header to flip the card and see terminal details, tags, command history, and quick actions on the back face
- **File editor** -- tap the editor button on any host card to open the file editor in a fullscreen overlay
- **Screenshots and streams** -- view captured screenshots and live screen shares in the media section

### Desktop-specific features

- **Auto Layout** -- click the "Auto Layout" button in the canvas toolbar to arrange all nodes in a top-down hierarchy using dagre graph layout
- **Split terminal view** -- in fullscreen terminal mode, click the split icon to view multiple terminals side-by-side (horizontal, vertical, or quad split) with terminal selector dropdowns per pane

### 7. View command history

Open the overflow menu on any terminal and select **Command History**. A linked history node appears on the canvas showing all commands entered in that terminal. Switch to the **Top 10** tab to see the most frequently used commands. Each command has **copy** and **execute** buttons -- execute re-sends the command to the terminal.

### 8. Share with others

Copy the workspace URL and send it to anyone. They join instantly as a collaborator -- no accounts needed.

## CLI Reference

| Environment Variable | Required | Default | Description |
|---|---|---|---|
| `SERVICE_API_KEY` | Yes | -- | Per-workspace API key (auto-generated, shown in "Connect a Host" dialog) |
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

- Frontend: React 19, Vite 6, Tailwind CSS 4, `@xyflow/react`, xterm.js, dagre, TanStack Query, Zustand, SignalR
- Backend: Hono, TypeScript, Drizzle ORM, SQLite, Redis
- Realtime hub: ASP.NET Core SignalR on .NET 10 LTS
- Agent: Node.js, `node-pty`, SignalR client (`npm install -g excaliterm`)
- Tooling: pnpm workspaces, Turborepo, Docker Compose

## Self-Hosting

### Docker

```bash
docker compose up --build -d
```

This starts four containers: Redis, Backend API, SignalR Hub, and Frontend. Open **http://localhost:5173** -- a workspace is created automatically. Then follow steps 2-6 above. The "Connect a Host" dialog in the UI provides the full connection command with the workspace API key pre-filled.

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
- `INTERNAL_API_SECRET` — shared secret the hub uses to call the backend's
  internal `/api/validate-key` endpoint. Must be at least 32 characters.
  Generate one with `openssl rand -hex 32`.
- `TRUST_PROXY` — set to `true` only when the backend sits behind a trusted
  reverse proxy. Defaults to `false`, in which case the rate-limiter uses the
  TCP peer address (unspoofable) instead of `X-Forwarded-For`.

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

## Agent Discovery

Excaliterm implements several standards for AI agent discoverability:

| Standard | Endpoint | Description |
|---|---|---|
| Sitemap | `/sitemap.xml` | Canonical URL listing |
| Robots | `/robots.txt` | Crawl policy with sitemap reference |
| API Catalog (RFC 9727) | `/.well-known/api-catalog` | `application/linkset+json` API discovery |
| MCP Server Card | `/.well-known/mcp/server-card.json` | Model Context Protocol server metadata |
| Agent Skills (v0.2.0) | `/.well-known/agent-skills/index.json` | Agent skills discovery index |
| Link Headers (RFC 8288) | All pages | `Link` response headers for agent discovery |
| Markdown for Agents | Homepage | `Accept: text/markdown` content negotiation |
| WebMCP | All pages | Browser-exposed tools via `navigator.modelContext` |

## Documentation

- [Features](./docs/features/README.md) — per-feature user and technical docs
- [Architecture](./docs/architecture.md)
- [Setup Guide](./docs/setup.md)
- [API Reference](./docs/api-reference.md)
- [SignalR Protocol](./docs/websocket-protocol.md)
- [Development Guide](./docs/development.md)
- [Terminal Agent Guide](./docs/windows-service.md)
- [Deployment](./docs/deployment.md)

## License

MIT
