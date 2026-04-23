# Terminal Agent Guide

This file keeps its legacy name, but the current runtime component is `apps/terminal-agent`, not the old .NET Windows service described by earlier docs.

## What the Terminal Agent Does

The terminal agent is a Node.js process that:

- launches shell processes with `node-pty`
- connects to the SignalR terminal hub
- connects to the SignalR file hub
- executes terminal lifecycle commands
- serves file listing, read, and write requests

## Requirements

- Node.js 20+
- access to the SignalR hub URL
- a valid per-workspace API key (used as `SERVICE_API_KEY`)
- a `WORKSPACE_ID` matching the target workspace

Platform notes:

- On Windows, the default shell is `powershell.exe -NoLogo -NoProfile`
- On macOS/Linux, the default shell is the current `SHELL` or `/bin/bash`
- Screenshots and screen sharing work on all platforms via the `screenshot-desktop` library
- On Linux, screenshot capture requires one of: `scrot`, `ImageMagick` (`import`), or `xfce4-screenshooter`
- On macOS, screenshot capture uses the built-in `screencapture` command (no extra install needed)

## Configuration

The agent loads environment variables from the current process and then falls back to the repo root `.env`.

| Variable | Required | Description |
|----------|----------|-------------|
| `SIGNALR_HUB_URL` | Yes | Base URL of the hub, default `http://localhost:5000` |
| `SERVICE_API_KEY` | Yes | Per-workspace API key (auto-generated, shown in the "Connect a Host" dialog) |
| `SERVICE_ID` | Recommended | Stable identifier for this service instance |
| `WORKSPACE_ID` | Yes | Workspace to join |
| `WHITELISTED_PATHS` | Optional | Comma-separated allowed roots for file access |
| `SHELL_OVERRIDE` | Optional | Explicit shell executable |

Example:

```dotenv
SIGNALR_HUB_URL=http://localhost:5000
SERVICE_API_KEY=your-workspace-api-key
SERVICE_ID=my-agent-01
WORKSPACE_ID=Ab12Cd34Ef56
WHITELISTED_PATHS=/app,/home,/var/log
SHELL_OVERRIDE=
```

Important:

- `WORKSPACE_ID` should match the workspace ID in the frontend URL.
- The hub and agent use `workspaceId`; the backend and frontend mostly call the same value `workspaceId`.

## Running in Development

```bash
pnpm --filter @excaliterm/terminal-agent dev
```

PowerShell example with an explicit workspace:

```powershell
$env:WORKSPACE_ID = "<workspaceId>"
pnpm --filter @excaliterm/terminal-agent dev
```

On startup, the agent logs:

- service ID
- workspace ID
- hub URL
- chosen shell
- effective whitelist

## Production Run

Build first:

```bash
pnpm --filter @excaliterm/terminal-agent build
```

Then run:

```bash
node apps/terminal-agent/dist/index.js
```

Use an external process manager for long-running deployments, for example:

- `systemd`
- `pm2`
- `supervisord`
- NSSM or Windows Task Scheduler

## Connection Flow

### Terminal hub

The agent connects to:

```text
<SIGNALR_HUB_URL>/hubs/terminal?apiKey=<SERVICE_API_KEY>&workspaceId=<WORKSPACE_ID>
```

Then it calls:

```text
RegisterService(serviceId, apiKey)
```

After that it listens for:

- `CreateTerminal`
- `DestroyTerminal`
- `TerminalInput`
- `TerminalResize`

And publishes:

- `TerminalCreated`
- `TerminalOutput`
- `TerminalExited`
- `TerminalError`

### File hub

The agent also connects to:

```text
<SIGNALR_HUB_URL>/hubs/file?apiKey=<SERVICE_API_KEY>&workspaceId=<WORKSPACE_ID>
```

It listens for:

- `ListDirectory`
- `ReadFile`
- `WriteFile`

And replies with:

- `DirectoryListingResponse`
- `FileContentResponse`
- `FileErrorResponse`

## Filesystem Safety

File access is restricted twice:

1. The SignalR hub validates requested paths against its own allowlist.
2. The terminal agent validates paths against `WHITELISTED_PATHS`.

Keep `WHITELISTED_PATHS` narrow in production.

## Troubleshooting

### Agent cannot connect to the hub

Check:

- `SIGNALR_HUB_URL`
- `SERVICE_API_KEY`
- hub logs
- reverse proxy rules for `/hubs/*`

### Agent connects but terminal creation never arrives

Check:

- the backend can reach Redis
- the hub has Redis enabled
- the workspace has an online service
- `WORKSPACE_ID` matches the workspace in the browser

### Agent connects but file operations fail

Check:

- the path passes the hub-side allowlist
- the path is inside `WHITELISTED_PATHS`
- the selected service belongs to the same workspace
