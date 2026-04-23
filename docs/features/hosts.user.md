# Hosts & Services

A **host** is a machine running the `excaliterm` CLI and connected to your workspace. Each host can run multiple terminals and expose its files to the editor.

## Connecting a host

1. Click **Connect a Host** in the canvas toolbar (or on the mobile Hosts section).
2. The dialog shows the full connection command pre-filled with `SERVICE_API_KEY`, `SIGNALR_HUB_URL`, and `WORKSPACE_ID`.
3. Copy it, open a shell on the machine you want to connect, and run it. See the [README](../../README.md) for CLI install and env-var reference.
4. When the agent logs `Ready and waiting for commands`, the UI shows the host as **Online**.

The API key is shown masked; click the eye icon to reveal or copy it.

## Host node

Every connected host appears as a node on the canvas with:

- Host display name
- Status indicator — green (online) or gray (offline)
- **Terminal** button — creates a new terminal on that host
- **Editor** button — opens a file editor connected to that host

## Managing hosts

Hover a host card (desktop) or tap the ⋯ menu (mobile) to open the config dialog:

- Rename display name
- View service ID and registration date
- **Shutdown** — gracefully powers down the remote machine
- **Delete** — unregisters the host (does not affect terminals already created)

## Mobile Hosts section

The mobile view has a dedicated **Hosts** section at the top of the list. Each host card shows:

- Colored left border — green when online, gray when offline
- Display name and (truncated) service ID
- For online hosts: **Terminal** (cyan) and **Editor** (blue) quick-action buttons
- For offline hosts: **Reconnect** button (shows the connection dialog)

Tapping a host name navigates to its node on the canvas.
