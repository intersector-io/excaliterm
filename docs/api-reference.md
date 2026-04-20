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
  "createdAt": "2026-04-20T12:00:00.000Z",
  "lastAccessedAt": "2026-04-20T12:00:00.000Z"
}
```

### `GET /workspaces/:id`

Returns workspace metadata if the workspace exists. Also updates `lastAccessedAt`.

Errors:

- `404` if the workspace does not exist

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
- The live SignalR hub currently authenticates service connections with the shared `SERVICE_API_KEY` environment variable.

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
