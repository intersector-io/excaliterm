# REST API Reference

Base URL: `http://localhost:3001`

All protected endpoints require a valid Better Auth session cookie. Unauthenticated requests receive a `401 Unauthorized` response.

---

## Authentication

Authentication is handled by Better Auth and mounted at `/api/auth/**`.

### POST /api/auth/sign-up

Register a new user account.

**Request:**

```json
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "password": "securepassword123"
}
```

**Response (200):**

```json
{
  "user": {
    "id": "abc123",
    "name": "Jane Doe",
    "email": "jane@example.com",
    "emailVerified": false,
    "image": null,
    "createdAt": "2025-01-15T10:30:00.000Z",
    "updatedAt": "2025-01-15T10:30:00.000Z"
  },
  "session": {
    "id": "session-id",
    "token": "session-token",
    "expiresAt": "2025-02-14T10:30:00.000Z"
  }
}
```

Sets a session cookie in the response headers.

### POST /api/auth/sign-in/email

Sign in with email and password.

**Request:**

```json
{
  "email": "jane@example.com",
  "password": "securepassword123"
}
```

**Response (200):**

```json
{
  "user": {
    "id": "abc123",
    "name": "Jane Doe",
    "email": "jane@example.com",
    "emailVerified": false,
    "image": null,
    "createdAt": "2025-01-15T10:30:00.000Z",
    "updatedAt": "2025-01-15T10:30:00.000Z"
  },
  "session": {
    "id": "session-id",
    "token": "session-token",
    "expiresAt": "2025-02-14T10:30:00.000Z"
  }
}
```

### POST /api/auth/sign-out

Sign out and invalidate the current session.

**Request:** No body required. Session cookie must be present.

**Response (200):**

```json
{
  "success": true
}
```

---

## Health

### GET /api/health

Public endpoint. Returns server status and whether the Windows Service is connected.

**Response (200):**

```json
{
  "status": "ok",
  "serviceConnected": true,
  "timestamp": "2025-01-15T10:30:00.000Z"
}
```

| Field              | Type    | Description                                      |
|--------------------|---------|--------------------------------------------------|
| `status`           | string  | Always `"ok"` if the server is running           |
| `serviceConnected` | boolean | Whether a Windows Service is connected via WebSocket |
| `timestamp`        | string  | Current server time (ISO 8601)                   |

---

## Terminals

All terminal endpoints require authentication.

### POST /api/terminals

Create a new terminal session and its canvas node. Sends a create command to the Windows Service.

**Request:**

```json
{
  "cols": 80,
  "rows": 24,
  "x": 200,
  "y": 150
}
```

| Field  | Type   | Default | Description                        |
|--------|--------|---------|------------------------------------|
| `cols` | number | 80      | Terminal column count              |
| `rows` | number | 24      | Terminal row count                 |
| `x`    | number | 100     | Canvas X position for the node     |
| `y`    | number | 100     | Canvas Y position for the node     |

**Response (201):**

```json
{
  "terminal": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "userId": "abc123",
    "status": "active",
    "exitCode": null,
    "createdAt": "2025-01-15T10:30:00.000Z",
    "updatedAt": "2025-01-15T10:30:00.000Z"
  },
  "canvasNode": {
    "id": "660e8400-e29b-41d4-a716-446655440001",
    "terminalSessionId": "550e8400-e29b-41d4-a716-446655440000",
    "userId": "abc123",
    "x": 200,
    "y": 150,
    "width": 600,
    "height": 400,
    "zIndex": 0,
    "createdAt": "2025-01-15T10:30:00.000Z",
    "updatedAt": "2025-01-15T10:30:00.000Z"
  }
}
```

**Error (503):**

```json
{
  "message": "Windows Service is not connected"
}
```

Returned when no Windows Service is currently connected via WebSocket.

### GET /api/terminals

List all terminal sessions for the authenticated user.

**Response (200):**

```json
{
  "terminals": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "userId": "abc123",
      "status": "active",
      "exitCode": null,
      "createdAt": "2025-01-15T10:30:00.000Z",
      "updatedAt": "2025-01-15T10:30:00.000Z"
    },
    {
      "id": "770e8400-e29b-41d4-a716-446655440002",
      "userId": "abc123",
      "status": "exited",
      "exitCode": 0,
      "createdAt": "2025-01-15T09:00:00.000Z",
      "updatedAt": "2025-01-15T09:45:00.000Z"
    }
  ]
}
```

### DELETE /api/terminals/:id

Delete (destroy) a terminal session. If the terminal is active and the Windows Service is connected, a destroy command is sent to kill the process.

**Response (200):**

```json
{
  "success": true
}
```

**Error (404):**

```json
{
  "message": "Terminal session not found"
}
```

Returned when the terminal does not exist or is not owned by the authenticated user.

---

## Canvas

All canvas endpoints require authentication.

### GET /api/canvas/nodes

List all canvas nodes for the authenticated user.

**Response (200):**

```json
{
  "nodes": [
    {
      "id": "660e8400-e29b-41d4-a716-446655440001",
      "terminalSessionId": "550e8400-e29b-41d4-a716-446655440000",
      "userId": "abc123",
      "x": 200,
      "y": 150,
      "width": 600,
      "height": 400,
      "zIndex": 0,
      "createdAt": "2025-01-15T10:30:00.000Z",
      "updatedAt": "2025-01-15T10:30:00.000Z"
    }
  ]
}
```

### PATCH /api/canvas/nodes/:id

Update a canvas node's position, size, or z-index. All fields in the request body are optional.

**Request:**

```json
{
  "x": 300,
  "y": 250,
  "width": 800,
  "height": 500,
  "zIndex": 1
}
```

| Field    | Type   | Description           |
|----------|--------|-----------------------|
| `x`      | number | Canvas X position     |
| `y`      | number | Canvas Y position     |
| `width`  | number | Node width in pixels  |
| `height` | number | Node height in pixels |
| `zIndex` | number | Stacking order        |

**Response (200):**

```json
{
  "node": {
    "id": "660e8400-e29b-41d4-a716-446655440001",
    "terminalSessionId": "550e8400-e29b-41d4-a716-446655440000",
    "userId": "abc123",
    "x": 300,
    "y": 250,
    "width": 800,
    "height": 500,
    "zIndex": 1,
    "createdAt": "2025-01-15T10:30:00.000Z",
    "updatedAt": "2025-01-15T11:00:00.000Z"
  }
}
```

**Error (404):**

```json
{
  "message": "Canvas node not found"
}
```

### DELETE /api/canvas/nodes/:id

Delete a canvas node.

**Response (200):**

```json
{
  "success": true
}
```

**Error (404):**

```json
{
  "message": "Canvas node not found"
}
```
