---
name: excaliterm
description: "Use the Excaliterm CLI to connect a machine to a collaborative terminal canvas workspace. Triggers when: installing or running excaliterm, configuring terminal agents, connecting hosts to workspaces, troubleshooting SignalR hub connections, setting up SERVICE_API_KEY or WORKSPACE_ID env vars, or when the user mentions excaliterm, terminal-agent, terminal canvas, or remote terminal proxy. Also use when configuring .env files for excaliterm services."
---

# Excaliterm CLI

Excaliterm is a terminal agent that connects a host machine to an Excaliterm workspace, enabling collaborative terminal sessions and file browsing through a web-based infinite canvas UI.

**npm package:** `excaliterm`
**Install:** `npm install -g excaliterm`
**Run without installing:** `npx excaliterm`

## How It Works

The CLI connects to a deployed Excaliterm SignalR hub and registers itself as a service for a specific workspace. Once connected, users in that workspace can create terminal sessions that spawn real shell processes on the agent's machine, and browse the agent's filesystem through the web UI.

## Configuration

All configuration is via environment variables. Create a `.env` file or export them in your shell.

### Required

| Variable | Description |
|----------|-------------|
| `SERVICE_API_KEY` | Per-workspace API key (auto-generated, shown in the "Connect a Host" dialog). The agent will refuse to start without this. |

### Recommended

| Variable | Default | Description |
|----------|---------|-------------|
| `SIGNALR_HUB_URL` | `http://localhost:5000` | Base URL of the SignalR hub |
| `WORKSPACE_ID` | `00000000-...` (null UUID) | The workspace ID from the browser URL (`/w/<id>`) |
| `SERVICE_ID` | `{hostname}-{pid}` | Stable identifier for this agent. Set this explicitly for persistent deployments so the service identity survives restarts. |

### Optional

| Variable | Default | Description |
|----------|---------|-------------|
| `WHITELISTED_PATHS` | *(empty = all)* | Comma-separated filesystem roots the agent is allowed to access. Empty means unrestricted. |
| `SHELL_OVERRIDE` | PowerShell (Win) / `$SHELL` or `/bin/bash` (Unix) | Custom shell executable path |

## Quick Start

### Step 1: Get the workspace ID

Open the Excaliterm web UI. The URL contains the workspace ID:
```
https://your-excaliterm.example.com/w/Ab12Cd34Ef56
                                      ^^^^^^^^^^^^
                                      this is your WORKSPACE_ID
```

### Step 2: Get the API key

Open the "Connect a Host" dialog in the workspace UI. It shows the full connection command with the workspace API key pre-filled. Each workspace has its own auto-generated API key.

### Step 3: Run the agent

```bash
# Via environment variables
export SIGNALR_HUB_URL="https://your-hub-url:5000"
export SERVICE_API_KEY="your-workspace-api-key"
export WORKSPACE_ID="Ab12Cd34Ef56"
excaliterm

# Or inline (useful for one-off runs)
SIGNALR_HUB_URL=https://hub:5000 SERVICE_API_KEY=secret WORKSPACE_ID=Ab12Cd34Ef56 excaliterm

# Or with a .env file in the current directory
echo 'SIGNALR_HUB_URL=https://hub:5000
SERVICE_API_KEY=secret
WORKSPACE_ID=Ab12Cd34Ef56' > .env
excaliterm
```

### Step 4: Verify

Once the agent logs `Ready and waiting for commands`, the web UI should show the host as online ("1 host ready" in the canvas toolbar). Create a terminal from the UI to confirm.

## What the Agent Does

Once connected, the agent handles these operations from the web UI:

**Terminal management:**
- Creates shell processes (PowerShell on Windows, bash on Linux/macOS)
- Streams terminal output back to the UI in real-time
- Accepts keyboard input from the UI
- Handles terminal resize events
- Cleans up processes on terminal close

**File operations:**
- Lists directory contents (sorted: directories first, then files alphabetically)
- Reads file contents (up to 10 MB limit)
- Writes files (creates parent directories as needed)
- All file operations respect `WHITELISTED_PATHS` restrictions

## Security Notes

- **`WHITELISTED_PATHS`** restricts filesystem access. In production, always set this to limit exposure. Symlinks pointing outside whitelisted directories are blocked.
- **`SERVICE_API_KEY`** authenticates the agent with the hub. The hub validates the key against the backend per-workspace (via `GET /api/validate-key`). If the key doesn't match the workspace, the connection is rejected.
- Path traversal attacks (`..`) are blocked after path normalization.
- Null bytes in paths are rejected.

## Troubleshooting

**"SERVICE_API_KEY is required"** - Set the `SERVICE_API_KEY` environment variable. Use the per-workspace API key from the "Connect a Host" dialog in the UI.

**Agent connects but UI shows "No host"** - The `WORKSPACE_ID` doesn't match. Copy the exact ID from the browser URL bar.

**Connection drops and reconnects** - Normal behavior. The agent has automatic reconnection with exponential backoff. It re-registers with the hub on reconnect.

**Terminals show "Host offline"** - The agent process stopped or lost connectivity. Restart it. For persistent deployments, use a process manager (pm2, systemd, or Windows NSSM).

**File browser shows "Empty directory"** - Check `WHITELISTED_PATHS`. If set, the browsed path must be under a whitelisted directory. If empty/unset, all paths are accessible.

## Running as a Persistent Service

For production, use a process manager:

```bash
# With pm2
pm2 start excaliterm --name my-workspace

# With systemd (create /etc/systemd/system/excaliterm.service)
# See docs/windows-service.md for Windows NSSM setup
```

## Docker Compose Context

When running the full Excaliterm stack via `docker compose up`, the agent runs **outside** Docker on the host machine. The containers provide: redis, backend API, SignalR hub, and frontend. Point the agent at the hub's exposed port (default 5000).

## Local Development

In the monorepo, the agent is at `apps/terminal-agent/`. Run it with:

```bash
WORKSPACE_ID=<id> pnpm --filter @excaliterm/terminal-agent dev
```

The `.env` in the monorepo root is loaded automatically.
