# WebSocket Protocol Specification

## Connection Endpoints

| Endpoint       | Client                  | Authentication                    |
|----------------|-------------------------|-----------------------------------|
| `/ws/client`   | Browser (frontend)      | Better Auth session cookie        |
| `/ws/service`  | Windows Service (.NET)  | API key via `service:hello` message |

## Message Envelope Format

All WebSocket messages are JSON strings with the following envelope structure:

```json
{
  "type": "<message-type>",
  "payload": { ... },
  "timestamp": 1700000000000
}
```

| Field       | Type   | Description                                     |
|-------------|--------|-------------------------------------------------|
| `type`      | string | Message type identifier (see sections below)    |
| `payload`   | object | Type-specific payload data                      |
| `timestamp` | number | Unix timestamp in milliseconds (epoch)          |

## Data Encoding

Terminal I/O data (keystrokes, output) is encoded as **base64** strings in the `data` field of relevant messages. This ensures safe transport of binary terminal data (escape sequences, control characters) over JSON.

---

## Service <-> Backend Protocol

### Authentication Flow

When the Windows Service connects to `/ws/service`, the first message it sends must be `service:hello` within 10 seconds, or the connection is closed.

### Service -> Backend Messages

#### `service:hello`

Sent immediately after connecting. Must be the first message.

```json
{
  "type": "service:hello",
  "payload": {
    "serviceId": "my-machine-01",
    "apiKey": "shared-secret-key"
  },
  "timestamp": 1700000000000
}
```

| Payload Field | Type   | Description                              |
|---------------|--------|------------------------------------------|
| `serviceId`   | string | Identifier for this service instance     |
| `apiKey`      | string | Must match backend's `SERVICE_API_KEY`   |

**Error codes:**
- `4001` - Authentication timeout (no `service:hello` within 10 seconds)
- `4002` - First message was not `service:hello`
- `4003` - Invalid API key
- `4004` - Replaced by a newer service connection

#### `service:terminal:created`

Confirms that a terminal process was started successfully.

```json
{
  "type": "service:terminal:created",
  "payload": {
    "terminalId": "uuid-string"
  },
  "timestamp": 1700000000000
}
```

#### `service:terminal:output`

Streams terminal output data from a ConPTY process.

```json
{
  "type": "service:terminal:output",
  "payload": {
    "terminalId": "uuid-string",
    "data": "base64-encoded-output"
  },
  "timestamp": 1700000000000
}
```

| Payload Field | Type   | Description                              |
|---------------|--------|------------------------------------------|
| `terminalId`  | string | Terminal session UUID                    |
| `data`        | string | Base64-encoded terminal output bytes     |

#### `service:terminal:exited`

Indicates a terminal process has exited.

```json
{
  "type": "service:terminal:exited",
  "payload": {
    "terminalId": "uuid-string",
    "exitCode": 0
  },
  "timestamp": 1700000000000
}
```

#### `service:terminal:error`

Reports an error related to a terminal.

```json
{
  "type": "service:terminal:error",
  "payload": {
    "terminalId": "uuid-string",
    "error": "Failed to start process"
  },
  "timestamp": 1700000000000
}
```

### Backend -> Service Messages

#### `backend:terminal:create`

Instructs the service to create a new terminal process.

```json
{
  "type": "backend:terminal:create",
  "payload": {
    "terminalId": "uuid-string",
    "cols": 80,
    "rows": 24
  },
  "timestamp": 1700000000000
}
```

#### `backend:terminal:write`

Sends input data to a terminal process.

```json
{
  "type": "backend:terminal:write",
  "payload": {
    "terminalId": "uuid-string",
    "data": "base64-encoded-input"
  },
  "timestamp": 1700000000000
}
```

#### `backend:terminal:resize`

Resizes a terminal process.

```json
{
  "type": "backend:terminal:resize",
  "payload": {
    "terminalId": "uuid-string",
    "cols": 120,
    "rows": 40
  },
  "timestamp": 1700000000000
}
```

#### `backend:terminal:destroy`

Instructs the service to terminate a terminal process.

```json
{
  "type": "backend:terminal:destroy",
  "payload": {
    "terminalId": "uuid-string"
  },
  "timestamp": 1700000000000
}
```

---

## Client <-> Backend Protocol

### Authentication

Browser clients connect to `/ws/client` and are authenticated using their Better Auth session cookie. The backend extracts the session from the HTTP upgrade request headers. Unauthenticated connections are immediately closed with code `4001`.

### Client -> Backend Messages

#### `client:terminal:input`

Sends user keystrokes to a terminal.

```json
{
  "type": "client:terminal:input",
  "payload": {
    "terminalId": "uuid-string",
    "data": "base64-encoded-input"
  }
}
```

The backend verifies that the authenticated user owns the terminal before forwarding to the service.

#### `client:terminal:resize`

Requests a terminal resize (typically triggered by the user resizing the canvas node).

```json
{
  "type": "client:terminal:resize",
  "payload": {
    "terminalId": "uuid-string",
    "cols": 120,
    "rows": 40
  }
}
```

### Backend -> Client Messages

#### `server:terminal:output`

Streams terminal output to the browser.

```json
{
  "type": "server:terminal:output",
  "payload": {
    "terminalId": "uuid-string",
    "data": "base64-encoded-output"
  }
}
```

#### `server:terminal:created`

Confirms a terminal was created (sent after the service confirms creation).

```json
{
  "type": "server:terminal:created",
  "payload": {
    "terminalId": "uuid-string"
  }
}
```

#### `server:terminal:exited`

Notifies the client that a terminal process has exited.

```json
{
  "type": "server:terminal:exited",
  "payload": {
    "terminalId": "uuid-string",
    "exitCode": 0
  }
}
```

#### `server:terminal:error`

Notifies the client of a terminal error.

```json
{
  "type": "server:terminal:error",
  "payload": {
    "terminalId": "uuid-string",
    "error": "Error message"
  }
}
```

---

## Message Routing

The backend acts as a message router. It does not blindly forward messages -- it performs authorization checks:

1. **Client input/resize**: The backend verifies terminal ownership by looking up the `terminal_session` table before forwarding to the service.
2. **Service output/events**: The backend looks up the terminal owner and sends the message only to WebSocket connections belonging to that user.
3. **Multi-connection support**: A single user can have multiple browser tabs connected. Output is sent to all active WebSocket connections for that user.

## Reconnection

The Windows Service implements automatic reconnection with exponential backoff:

- Initial delay: `ReconnectDelayMs` (default 3000ms)
- Maximum delay: `MaxReconnectDelayMs` (default 30000ms)
- The delay doubles after each failed attempt and resets on successful connection.
- On reconnect, the service sends `service:hello` again to re-authenticate.
