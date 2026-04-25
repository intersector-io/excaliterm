# REST API Reference

Base backend URL: `http://localhost:3001/api`

The current API is workspace-scoped. There is no active Better Auth flow in the implemented routes. Access to most resources is controlled by `workspaceId` in the URL.

## Health

### `GET /health`

Returns backend health and aggregate service presence.

Example response:

```json
{
  "status": "ok",
  "serviceConnected": true,
  "connectedServices": 1,
  "timestamp": "2026-04-20T12:00:00.000Z"
}
```

## Workspaces

### `POST /workspaces`

Creates a new workspace.

Example response:

```json
{
  "id": "Ab12Cd34Ef56",
  "name": "Untitled workspace",
  "apiKey": "auto-generated-key",
  "createdAt": "2026-04-20T12:00:00.000Z",
  "lastAccessedAt": "2026-04-20T12:00:00.000Z"
}
```

The `apiKey` is auto-generated when the workspace is created and is returned **only** on this creation response. It is used by terminal agents to authenticate with the SignalR hub. Store it immediately — the backend will not return it again.

Rate limit: 5 requests per hour per client IP.

### `GET /workspaces/:id`

Returns workspace metadata if the workspace exists. Also updates `lastAccessedAt`.

The response intentionally **omits** `apiKey` — workspace IDs are shareable, but API keys are secrets.

Errors:

- `404` if the workspace does not exist

### Trust model

- The workspace ID is a shareable link and grants browser-level access to the workspace's canvas, terminals, and files.
- The workspace `apiKey` is a secret and is only used by terminal agents to register with the SignalR hub.
- `/api/validate-key` is an internal endpoint gated by an `X-Internal-Secret` header that must match `INTERNAL_API_SECRET`. External callers receive 404.
- The SignalR hub enforces that a browser connected to workspace A cannot drive terminals owned by workspace B (cross-workspace terminal input, resize, buffer replay, and lock acquisition are all rejected).

## Workspace-Scoped Routes

All routes below are mounted under:

```text
/api/w/:workspaceId
```

If `workspaceId` is missing or invalid, the backend rejects the request before it reaches the route handler.

## Terminals

### `POST /w/:workspaceId/terminals`

Creates a terminal session and a terminal canvas node.

Request body:

```json
{
  "cols": 80,
  "rows": 24,
  "x": 200,
  "y": 150
}
```

Fields:

- `cols`: optional, defaults to `80`
- `rows`: optional, defaults to `24`
- `x`: optional, defaults to `100`
- `y`: optional, defaults to `100`

Example response:

```json
{
  "terminal": {
    "id": "terminal-id",
    "status": "active",
    "exitCode": null,
    "createdAt": "2026-04-20T12:00:00.000Z",
    "updatedAt": "2026-04-20T12:00:00.000Z"
  },
  "canvasNode": {
    "id": "node-id",
    "terminalSessionId": "terminal-id",
    "nodeType": "terminal",
    "noteId": null,
    "x": 200,
    "y": 150,
    "width": 600,
    "height": 400,
    "zIndex": 0,
    "createdAt": "2026-04-20T12:00:00.000Z",
    "updatedAt": "2026-04-20T12:00:00.000Z"
  }
}
```

Errors:

- `503` if no online service is available for the workspace

### `GET /w/:workspaceId/terminals`

Lists terminal sessions for the workspace.

Example response:

```json
{
  "terminals": [
    {
      "id": "terminal-id",
      "status": "active",
      "exitCode": null,
      "createdAt": "2026-04-20T12:00:00.000Z",
      "updatedAt": "2026-04-20T12:00:00.000Z"
    }
  ]
}
```

### `DELETE /w/:workspaceId/terminals/:id`

Marks the terminal as exited and publishes a destroy command if it is still active.

Example response:

```json
{
  "success": true
}
```

Errors:

- `404` if the terminal is not part of the workspace

## Canvas

### `GET /w/:workspaceId/canvas/nodes`

Lists all canvas nodes for the workspace.

Example response:

```json
{
  "nodes": [
    {
      "id": "node-id",
      "terminalSessionId": "terminal-id",
      "nodeType": "terminal",
      "noteId": null,
      "x": 100,
      "y": 100,
      "width": 600,
      "height": 400,
      "zIndex": 0,
      "createdAt": "2026-04-20T12:00:00.000Z",
      "updatedAt": "2026-04-20T12:00:00.000Z"
    }
  ]
}
```

### `PATCH /w/:workspaceId/canvas/nodes/:id`

Updates one or more of:

- `x`
- `y`
- `width`
- `height`
- `zIndex`

Request body example:

```json
{
  "x": 320,
  "y": 180,
  "width": 720,
  "height": 480
}
```

Response:

```json
{
  "node": {
    "id": "node-id",
    "terminalSessionId": "terminal-id",
    "nodeType": "terminal",
    "noteId": null,
    "x": 320,
    "y": 180,
    "width": 720,
    "height": 480,
    "zIndex": 0,
    "createdAt": "2026-04-20T12:00:00.000Z",
    "updatedAt": "2026-04-20T12:05:00.000Z"
  }
}
```

### `DELETE /w/:workspaceId/canvas/nodes/:id`

Deletes a canvas node.

Response:

```json
{
  "success": true
}
```

## Services

### `GET /w/:workspaceId/services`

Lists service entries for the workspace.

Example response:

```json
{
  "services": [
    {
      "id": "db-id",
      "serviceId": "runtime-service-id",
      "name": "host-a",
      "apiKey": "generated-key",
      "whitelistedPaths": null,
      "status": "online",
      "lastSeen": "2026-04-20T12:00:00.000Z",
      "createdAt": "2026-04-20T11:00:00.000Z",
      "updatedAt": "2026-04-20T12:00:00.000Z"
    }
  ]
}
```

### `POST /w/:workspaceId/services`

Creates a service entry.

Request body:

```json
{
  "name": "host-a",
  "whitelistedPaths": "/app,/home"
}
```

Response:

```json
{
  "service": {
    "id": "db-id",
    "serviceId": "runtime-service-id",
    "name": "host-a",
    "apiKey": "generated-key",
    "whitelistedPaths": "/app,/home",
    "status": "offline",
    "lastSeen": null,
    "createdAt": "2026-04-20T12:00:00.000Z",
    "updatedAt": "2026-04-20T12:00:00.000Z"
  }
}
```

### `PATCH /w/:workspaceId/services/:id`

Updates:

- `name`
- `whitelistedPaths`

### `DELETE /w/:workspaceId/services/:id`

Deletes the service entry.

### `POST /w/:workspaceId/services/:id/regenerate-key`

Generates and returns a new stored API key for the service entry.

Response:

```json
{
  "apiKey": "new-generated-key"
}
```

Note:

- The stored service-entry `apiKey` is part of the REST model.
- The SignalR hub validates API keys by calling the backend's `GET /validate-key` endpoint (see below), checking against the per-workspace key.

## API Key Validation

### `GET /validate-key`

Used by the SignalR hub to validate a terminal agent's API key against the workspace. This is not a workspace-scoped route; it uses query parameters instead.

Query parameters:

- `workspaceId`: the workspace ID
- `apiKey`: the API key to validate

Example response (valid):

```json
{
  "valid": true
}
```

Example response (invalid):

```json
{
  "valid": false
}
```

This endpoint replaces the previous approach where the hub validated against a single shared `SERVICE_API_KEY` environment variable. The hub now calls this endpoint on each service connection to verify the key matches the target workspace.

## Notes

### `GET /w/:workspaceId/notes`

Lists notes for the workspace.

### `POST /w/:workspaceId/notes`

Creates a note and its corresponding canvas node.

Request body:

```json
{
  "content": "Todo list",
  "x": 100,
  "y": 100
}
```

Response:

```json
{
  "note": {
    "id": "note-id",
    "content": "Todo list",
    "createdAt": "2026-04-20T12:00:00.000Z",
    "updatedAt": "2026-04-20T12:00:00.000Z"
  },
  "canvasNode": {
    "id": "node-id",
    "terminalSessionId": null,
    "nodeType": "note",
    "noteId": "note-id",
    "x": 100,
    "y": 100,
    "width": 300,
    "height": 300,
    "zIndex": 0,
    "createdAt": "2026-04-20T12:00:00.000Z",
    "updatedAt": "2026-04-20T12:00:00.000Z"
  }
}
```

### `PATCH /w/:workspaceId/notes/:id`

Updates note content.

### `DELETE /w/:workspaceId/notes/:id`

Deletes the note and its linked canvas node.

## Chat

### `GET /w/:workspaceId/chat`

Returns paginated chat history.

Query parameters:

- `limit`: default `50`, maximum `100`
- `offset`: default `0`

Example response:

```json
{
  "messages": [
    {
      "id": "msg-id",
      "displayName": "Renato",
      "content": "hello",
      "createdAt": "2026-04-20T12:00:00.000Z"
    }
  ],
  "limit": 50,
  "offset": 0
}
```

## Command History

### `POST /w/:workspaceId/command-history`

Saves a command to the history for a terminal session.

Request body:

```json
{
  "terminalSessionId": "terminal-id",
  "command": "ls -la"
}
```

Response:

```json
{
  "command": {
    "id": "command-id",
    "terminalSessionId": "terminal-id",
    "command": "ls -la",
    "executedAt": "2026-04-22T12:00:00.000Z"
  }
}
```

Errors:

- `400` if `command` is empty or exceeds 1000 characters
- `404` if the terminal session is not part of the workspace

### `GET /w/:workspaceId/command-history/:terminalSessionId`

Lists commands for a terminal session, ordered by most recent first.

Query parameters:

- `limit`: default `100`, maximum `500`

Response:

```json
{
  "commands": [
    {
      "id": "command-id",
      "terminalSessionId": "terminal-id",
      "command": "ls -la",
      "executedAt": "2026-04-22T12:00:00.000Z"
    }
  ]
}
```

### `GET /w/:workspaceId/command-history/:terminalSessionId/top`

Returns the top 10 most frequently used commands for a terminal session.

Response:

```json
{
  "commands": [
    {
      "command": "ls -la",
      "count": 5,
      "lastExecutedAt": "2026-04-22T12:00:00.000Z"
    }
  ]
}
```

### `POST /w/:workspaceId/command-history/node`

Creates a command-history canvas node linked to a terminal, with an edge connecting the terminal node to the new history node.

Request body:

```json
{
  "terminalSessionId": "terminal-id",
  "sourceTerminalNodeId": "canvas-node-id",
  "x": 800,
  "y": 100
}
```

Response:

```json
{
  "canvasNode": {
    "id": "node-id",
    "terminalSessionId": "terminal-id",
    "nodeType": "command-history",
    "x": 800,
    "y": 100,
    "width": 380,
    "height": 420,
    "zIndex": 0,
    "createdAt": "2026-04-22T12:00:00.000Z",
    "updatedAt": "2026-04-22T12:00:00.000Z"
  },
  "canvasEdge": {
    "id": "edge-id",
    "workspaceId": "workspace-id",
    "sourceNodeId": "canvas-node-id",
    "targetNodeId": "node-id",
    "createdAt": "2026-04-22T12:00:00.000Z"
  }
}
```

## Files

### `GET /w/:workspaceId/files/tree/:serviceId`

Currently a placeholder route. It verifies that the service exists in the workspace, then returns an empty tree plus a message stating that file tree access will be proxied through SignalR.

Example response:

```json
{
  "serviceId": "runtime-service-id",
  "serviceName": "host-a",
  "tree": [],
  "message": "File tree will be proxied via SignalR in a future update"
}
```

## Public Terminal Read Endpoint

Mounted **outside** workspace scope so external agents (Claude Code with MCP, custom scripts, anything that speaks HTTP) can read a terminal's output.

### `GET /api/terminals/:id/output`

Per-route rate limit: 120 requests / 60s / IP.

Headers:

| header | required | notes |
|---|---|---|
| `X-Terminal-Read-Token` | yes | Compared timing-safe against the terminal's read token. |

Query:

| param | default | notes |
|---|---|---|
| `lines` | 200 | Number of trailing lines to return. Clamped to `[1, 1000]`. |

Returns:

```json
{
  "terminalId": "...",
  "lines": ["line 1", "line 2", "..."],
  "totalLines": 200,
  "capturedAt": "2026-04-25T..."
}
```

Source: the per-terminal Redis output buffer (1000 entries, 24h TTL). Quiet terminals will return empty `lines: []` — clients should not infer "terminal dead" from empty output alone.

| code | meaning |
|---|---|
| 200 | success |
| 401 | wrong/missing `X-Terminal-Read-Token` |
| 404 | unknown terminal id |
| 429 | rate limit hit |

### Rotate the read token

`POST /api/w/:workspaceId/terminals/:id/rotate-read-token`

Workspace-scoped. Generates a new read token. The old one stops working immediately. Returns the updated terminal:

```json
{ "terminal": { "id": "...", "readToken": "new-uuid", "..." } }
```

## Triggers

Triggers automate input to a terminal. Two types: `timer` (in-process scheduler fires a stored prompt every N minutes) and `http` (public webhook URL — caller POSTs the prompt). One of each type per terminal (enforced by a unique index on `(terminalNodeId, type)`).

### `GET /w/:workspaceId/triggers`

Lists every trigger in the workspace.

```json
{
  "triggers": [
    {
      "id": "8e298a12-...",
      "workspaceId": "1nm8pj3HLMfq",
      "terminalNodeId": "3e774e60-...",
      "terminalSessionId": "27085aa7-...",
      "type": "timer",
      "enabled": true,
      "config": { "intervalMin": 5, "prompt": "git pull && pnpm test", "language": "shell" },
      "lastFiredAt": "2026-04-25T00:42:46.000Z",
      "lastError": null,
      "createdAt": "2026-04-25T00:40:45.000Z",
      "updatedAt": "2026-04-25T00:42:46.000Z"
    }
  ]
}
```

### `POST /w/:workspaceId/triggers`

Create a trigger attached to a terminal node. Inserts the trigger row, a canvas node (`nodeType: "trigger"`), and an edge from the terminal node — atomically in a single transaction.

Body:

```json
{
  "terminalNodeId": "3e774e60-...",
  "type": "timer",
  "config": { "intervalMin": 5, "prompt": "git pull", "language": "shell" }
}
```

For `type: "http"`, the server generates `config.secret` automatically; you don't supply it. For `type: "timer"`, all `config` fields are optional and default to `{ intervalMin: 5, prompt: "", language: "shell" }`.

Returns `201` with `{ trigger, canvasNode, canvasEdge }`. Trigger node default size is 300×280 for timer, 340×260 for http.

Errors: `400` (missing `terminalNodeId`, unsupported `type`), `404` (terminal node not in workspace), `409` (a trigger of this type is already attached to this terminal).

### `PATCH /w/:workspaceId/triggers/:id`

Update `enabled` and (for timer triggers) `config`. HTTP triggers ignore `config` here — use `/rotate` to change the secret.

Body (timer):

```json
{ "enabled": true, "config": { "intervalMin": 10, "prompt": "echo hi" } }
```

Body (http):

```json
{ "enabled": true }
```

Returns `{ trigger }`. For timer triggers, the in-process scheduler reschedules. Rejects enabling a timer with empty prompt (`400`).

### `POST /w/:workspaceId/triggers/:id/rotate`

HTTP triggers only. Generates a new random `secret`. The old secret immediately stops working. Returns the updated trigger with the new secret in `config.secret`.

Errors: `400` (trigger isn't an HTTP trigger), `404` (not found in workspace).

### `POST /w/:workspaceId/triggers/:id/fire`

Manual fire for **timer triggers only**. Submits the trigger's stored prompt to the terminal immediately, regardless of the timer schedule and regardless of `enabled`. Returns `{ success: true }`.

Errors: `400` (trigger is HTTP — use the public endpoint), `404`.

### `DELETE /w/:workspaceId/triggers/:id`

Unschedules the trigger, deletes its canvas node (cascading the edge via FK), and deletes the trigger row.

## Public Trigger Endpoint

Mounted **outside** workspace scope so external systems (CI runs, cron-job.org, Slack hooks, curl) can hit it directly.

### `POST /api/triggers/:id/fire`

Per-route rate limit: 60 requests / 60 s / IP. Independent of the global 100/min limiter so external traffic can't cap your UI.

Headers:

| header | required | notes |
|---|---|---|
| `X-Trigger-Token` | yes | Compared timing-safe against the trigger's `secret`. |
| `Content-Type` | recommended | `application/json` |
| `X-Trigger-Require-Idle` | optional | Integer seconds (1–3600). If set, the call returns `409` when the terminal has produced output within the last N seconds. Useful for agentic loops that should only nudge an idle agent. |

Body:

```json
{ "prompt": "echo hello from webhook" }
```

The `prompt` is sent to the terminal verbatim with a final `\r` appended (one Enter). Multi-line prompts are allowed; embedded `\n` characters are line-discipline Enter, so each line submits independently — use `;` (PowerShell/bash) or `&&` if you need a single statement.

Success:

```json
{ "ok": true, "firedAt": "2026-04-25T13:27:02.594Z" }
```

| code | meaning |
|---|---|
| 200 | fired |
| 400 | missing or empty `prompt` |
| 401 | wrong/missing `X-Trigger-Token` |
| 403 | trigger is paused (`enabled: false`) |
| 404 | trigger id not found, or it's not an HTTP trigger (timer triggers are not exposed here) |
| 409 | `X-Trigger-Require-Idle: N` was set and terminal produced output within the last N seconds; body `{ ok: false, error: "Terminal busy", lastOutputAt }` |
| 429 | rate limit |
| 502 | publish to terminal failed (host probably offline) |

Example:

```bash
curl -X POST 'https://your-host/api/triggers/<id>/fire' \
  -H 'X-Trigger-Token: <secret>' \
  -H 'Content-Type: application/json' \
  -d '{"prompt":"git pull && pnpm test"}'
```
