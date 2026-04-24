# Terminals — Technical

## Data model

Table `terminal_session`:

| Column | Notes |
|---|---|
| `id` | PK |
| `workspaceId` | FK |
| `serviceInstanceId` | FK to host, nullable |
| `tags` | Comma-separated user tags |
| `status` | `active` \| `disconnected` \| `exited` \| `error` |
| `exitCode` | Int, nullable |
| `createdAt`, `updatedAt` | Timestamps |

## REST endpoints

- `POST /api/w/:workspaceId/terminals` — create. Body: `{ cols?, rows?, serviceInstanceId?, x?, y?, tags? }`. If `serviceInstanceId` is omitted, the most-recently-seen online service is chosen. Creates `terminal_session` + `canvas_node` (type `terminal`) + edge to the host node, then publishes `{ command: "terminal:create", terminalId, serviceInstanceId, workspaceId, cols, rows }` to Redis channel `terminal:commands`.
- `GET /api/w/:workspaceId/terminals` — list; joined with `service_instance` to include `serviceId`.
- `PATCH /api/w/:workspaceId/terminals/:id` — update tags.
- `DELETE /api/w/:workspaceId/terminals/:id?dismiss=true` — dismiss (removes row + canvas node + command history). Without `dismiss=true`: marks `exited`, publishes `terminal:destroy` if still active.
- `DELETE /api/w/:workspaceId/terminals` — close all active terminals in the workspace.

## SignalR — `TerminalHub`

### Browser → Hub

- `TerminalInput(terminalId, data)` — checks `IsLockedByOtherAsync`; forwards to service connection; emits throttled `TerminalTyping` (800 ms window).
- `TerminalResize(terminalId, cols, rows)` — lock-checked; forwards resize.
- `AcquireTerminalLock(terminalId)` / `ReleaseTerminalLock(terminalId)` — exclusive write lock (see [collaboration.technical.md](./collaboration.technical.md)).
- `RequestTerminalBuffer(terminalId)` — replays Redis-buffered output.

### Service/Agent → Hub

- `TerminalCreated(terminalId)`
- `TerminalOutput(terminalId, data)` — broadcast to workspace group; **buffered** in Redis list `terminal:buffer:{terminalId}` (max 1000 entries, 24h TTL).
- `TerminalExited(terminalId, exitCode)` — releases lock, clears buffer.
- `TerminalError(terminalId, message)`

### Hub → all browsers (workspace group)

- `TerminalOutput`, `TerminalCreated`, `TerminalExited`, `TerminalError`, `TerminalLockChanged`, `TerminalTyping`.

## Redis channels

- `terminal:commands` — backend → hub: terminal lifecycle commands addressed to specific services.
- `terminal:buffer:{terminalId}` — output ring buffer for reconnect replay.

## Rendering and input latency

- **WebGL renderer** (`@xterm/addon-webgl`). Loaded opportunistically; `onContextLoss` disposes the addon and the terminal falls back to the DOM renderer automatically.
- **Predictive local echo** (`predictive-echo.ts`). When the user types printable ASCII in an active, unlocked terminal that is on the normal (non-alt) screen buffer, the characters are written to xterm immediately and enqueued. Incoming `TerminalOutput` chunks are filtered: escape sequences pass through untouched; plain bytes matching the head of the prediction queue are stripped (consuming the server's echo so characters aren't duplicated). The queue is reset on alt-screen toggles (vim, htop, ...), lock/status changes, and terminal disposal. A 200 ms watchdog erases locally predicted characters with `\b \b` if no matching echo has arrived within 800 ms — this covers password prompts and other `stty -echo` contexts so secrets don't linger on screen.

## Agent side — PTY

- `apps/terminal-agent/src/terminal/manager.ts` maps `terminalId` → `TerminalProcess`.
- `apps/terminal-agent/src/terminal/process.ts` wraps `node-pty.spawn(shell, [], { cols, rows, cwd, env })`. Sets `TERM=xterm-256color` on Unix (not Windows). Uses `HOME`/`USERPROFILE` as cwd. Shell resolution uses `SHELL_OVERRIDE` if set, else `powershell.exe` on Windows and `$SHELL` (fallback `/bin/bash`) on Unix.
- Output callback forwards UTF-8 text to `TerminalOutput` over the terminal hub.

## Frontend

- `components/terminal/TerminalView.tsx` — xterm.js integration; scrollback 5000 lines. Loads `@xterm/addon-webgl` for GPU-accelerated rendering (silently falls back to the default DOM renderer if WebGL context creation fails or is lost).
- `components/terminal/predictive-echo.ts` — local echo predictor to hide SignalR round-trip latency while typing.
- `components/terminal/TerminalFullScreen.tsx` — fullscreen orchestration, flippable card, swipe, keyboard bar integration, scroll controls, `#focus=` hash sync.
- `components/terminal/TerminalInfoFace.tsx` — mobile back-face.
- `components/terminal/VirtualKeyboardBar.tsx` — mobile on-screen keyboard.
- `components/canvas/TerminalNode.tsx` — canvas node + overflow menu.
- `components/canvas/TagEditor.tsx` — tag chips editor.
- `hooks/use-terminal.ts` — REST hooks + mutation for create/update/dismiss.
- `stores/terminal-store.ts` — per-terminal output buffer (client-side).
- `lib/terminal-status.ts` — status classification and stale detection.
- `lib/signalr-client.ts` — shared SignalR connection wrapper.

## Key files

- `apps/backend/src/routes/terminals.ts`
- `apps/backend/src/db/schema.ts` (`terminal_session`)
- `apps/signalr-hub/Excaliterm.Hub/Hubs/TerminalHub.cs`
- `apps/signalr-hub/Excaliterm.Hub/Services/RedisSubscriber.cs` (`terminal:commands` handler)
- `apps/terminal-agent/src/hub/terminal-hub.ts`
- `apps/terminal-agent/src/terminal/`
