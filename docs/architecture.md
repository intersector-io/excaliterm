# Architecture

## Overview

Terminal Proxy is a remote terminal system that lets users interact with Windows PowerShell sessions through an infinite canvas web UI. The system consists of three main components that communicate over WebSocket connections.

## Components

### 1. Frontend (`apps/frontend`)

A React single-page application that renders terminal windows on an infinite canvas powered by React Flow (`@xyflow/react`). Each terminal is rendered using xterm.js (`@xterm/xterm`) inside a draggable, resizable canvas node.

**Key technologies:**
- React 19 + TypeScript
- Vite 6 (build tool)
- React Flow (`@xyflow/react`) for the infinite canvas
- xterm.js (`@xterm/xterm`) for terminal rendering
- Zustand for state management
- TanStack React Query for server state
- Tailwind CSS 4 + shadcn/ui components
- Better Auth (client) for authentication

### 2. Backend (`apps/backend`)

A Node.js HTTP and WebSocket server that acts as the central hub. It authenticates users, manages terminal and canvas state in a SQLite database, and routes terminal I/O between browser clients and the Windows Service.

**Key technologies:**
- Hono (HTTP framework) on Node.js
- WebSocket (`ws` library) for real-time communication
- Drizzle ORM + better-sqlite3 (SQLite database)
- Better Auth for session-based authentication
- Zod for environment validation
- TypeScript + tsx (dev runner)

### 3. Windows Service (`apps/windows-service`)

A .NET 8 Windows Service that manages actual PowerShell processes using the Windows ConPTY (Pseudo Console) API. It connects to the backend over WebSocket as a service client, receives commands to create/write/resize/destroy terminals, and streams terminal output back.

**Key technologies:**
- .NET 8 Worker Service
- Windows ConPTY API for pseudo-terminal management
- `System.Net.WebSockets.ClientWebSocket` for backend communication
- `System.Text.Json` for message serialization

## Communication Flow

```
+-------------------+         +-------------------+         +---------------------+
|                   |  HTTP   |                   |   WS    |                     |
|  Browser Client   |-------->|     Backend       |<------->|  Windows Service    |
|  (React + xterm)  |  REST   |  (Hono + Node.js) |         |  (.NET 8 Worker)    |
|                   |<--------|                   |         |                     |
|                   |         |                   |         |   +-------------+   |
|                   |   WS    |                   |         |   | PowerShell  |   |
|                   |<------->|                   |         |   | (ConPTY)    |   |
|                   |         |                   |         |   +-------------+   |
+-------------------+         +-------------------+         +---------------------+
     /ws/client                     SQLite               /ws/service
                                   Database
```

### Detailed Data Flow for Terminal I/O

**User types in terminal (input):**

```
Browser                   Backend                    Windows Service
  |                         |                              |
  |-- client:terminal:input -->                            |
  |   { terminalId, data }  |                              |
  |                         |-- backend:terminal:write --->|
  |                         |   { terminalId, data }       |
  |                         |                              |-- Write to ConPTY
  |                         |                              |   (base64 decoded)
```

**Terminal produces output:**

```
Browser                   Backend                    Windows Service
  |                         |                              |
  |                         |                              |<- ConPTY output
  |                         |                              |   (base64 encoded)
  |                         |<- service:terminal:output ---|
  |                         |   { terminalId, data }       |
  |<- server:terminal:output|                              |
  |   { terminalId, data }  |                              |
```

**Creating a new terminal:**

```
Browser                   Backend                    Windows Service
  |                         |                              |
  |-- POST /api/terminals ->|                              |
  |   { cols, rows, x, y } |                              |
  |                         |-- Insert DB records          |
  |                         |-- backend:terminal:create -->|
  |                         |   { terminalId, cols, rows } |
  |                         |                              |-- Start ConPTY
  |                         |<- service:terminal:created --|
  |                         |   { terminalId }             |
  |<- server:terminal:created                              |
  |   { terminalId }        |                              |
  |<-- 201 JSON response --|                              |
```

## Technology Stack Summary

| Layer            | Technology                        | Purpose                      |
|------------------|-----------------------------------|------------------------------|
| Frontend         | React 19, Vite 6, TypeScript      | UI framework and build       |
| Canvas           | @xyflow/react (React Flow)        | Infinite canvas with nodes   |
| Terminal UI      | @xterm/xterm                      | Terminal emulator in browser  |
| State Management | Zustand, TanStack React Query     | Client state, server state   |
| Styling          | Tailwind CSS 4, shadcn/ui         | UI components and design     |
| HTTP Framework   | Hono                              | REST API routing             |
| Database         | SQLite via Drizzle ORM            | Persistence                  |
| Authentication   | Better Auth                       | Session-based auth           |
| Validation       | Zod                               | Schema validation            |
| Windows Service  | .NET 8 Worker Service             | Background process host      |
| Terminal Host    | Windows ConPTY API                | Pseudo-terminal management   |
| Real-time        | WebSocket (ws / ClientWebSocket)  | Bidirectional communication  |
| Build System     | pnpm workspaces + Turborepo       | Monorepo orchestration       |
| Containerization | Docker + nginx                    | Production deployment        |

## Database Schema

The application uses SQLite with Drizzle ORM. The schema has two groups of tables:

### Better Auth Tables

These are managed by Better Auth for user authentication and session management.

#### `user`
| Column         | Type      | Notes                  |
|----------------|-----------|------------------------|
| id             | TEXT (PK) |                        |
| name           | TEXT      | NOT NULL               |
| email          | TEXT      | NOT NULL, UNIQUE       |
| emailVerified  | INTEGER   | Boolean, default false |
| image          | TEXT      | Nullable               |
| createdAt      | INTEGER   | Timestamp              |
| updatedAt      | INTEGER   | Timestamp              |

#### `session`
| Column    | Type      | Notes                          |
|-----------|-----------|--------------------------------|
| id        | TEXT (PK) |                                |
| expiresAt | INTEGER   | Timestamp                      |
| token     | TEXT      | NOT NULL, UNIQUE               |
| createdAt | INTEGER   | Timestamp                      |
| updatedAt | INTEGER   | Timestamp                      |
| ipAddress | TEXT      | Nullable                       |
| userAgent | TEXT      | Nullable                       |
| userId    | TEXT (FK) | References user(id), ON DELETE CASCADE |

#### `account`
| Column                | Type      | Notes                          |
|-----------------------|-----------|--------------------------------|
| id                    | TEXT (PK) |                                |
| accountId             | TEXT      | NOT NULL                       |
| providerId            | TEXT      | NOT NULL                       |
| userId                | TEXT (FK) | References user(id), ON DELETE CASCADE |
| accessToken           | TEXT      | Nullable                       |
| refreshToken          | TEXT      | Nullable                       |
| idToken               | TEXT      | Nullable                       |
| accessTokenExpiresAt  | INTEGER   | Nullable timestamp             |
| refreshTokenExpiresAt | INTEGER   | Nullable timestamp             |
| scope                 | TEXT      | Nullable                       |
| password              | TEXT      | Nullable (hashed)              |
| createdAt             | INTEGER   | Timestamp                      |
| updatedAt             | INTEGER   | Timestamp                      |

#### `verification`
| Column     | Type      | Notes              |
|------------|-----------|--------------------|
| id         | TEXT (PK) |                    |
| identifier | TEXT      | NOT NULL           |
| value      | TEXT      | NOT NULL           |
| expiresAt  | INTEGER   | Timestamp          |
| createdAt  | INTEGER   | Nullable timestamp |
| updatedAt  | INTEGER   | Nullable timestamp |

### Application Tables

#### `terminal_session`
| Column    | Type      | Notes                                    |
|-----------|-----------|------------------------------------------|
| id        | TEXT (PK) | UUID                                     |
| userId    | TEXT (FK) | References user(id), ON DELETE CASCADE   |
| status    | TEXT      | Enum: "active", "exited", "error"        |
| exitCode  | INTEGER   | Nullable                                 |
| createdAt | INTEGER   | Timestamp, default unixepoch()           |
| updatedAt | INTEGER   | Timestamp, default unixepoch()           |

#### `canvas_node`
| Column            | Type      | Notes                                          |
|-------------------|-----------|-------------------------------------------------|
| id                | TEXT (PK) | UUID                                            |
| terminalSessionId | TEXT (FK) | References terminal_session(id), ON DELETE SET NULL |
| userId            | TEXT (FK) | References user(id), ON DELETE CASCADE          |
| x                 | REAL      | Canvas X position, default 100                  |
| y                 | REAL      | Canvas Y position, default 100                  |
| width             | REAL      | Node width, default 600                         |
| height            | REAL      | Node height, default 400                        |
| zIndex            | INTEGER   | Stacking order, default 0                       |
| createdAt         | INTEGER   | Timestamp, default unixepoch()                  |
| updatedAt         | INTEGER   | Timestamp, default unixepoch()                  |

### Entity Relationships

```
user 1──* session
user 1──* account
user 1──* terminal_session
user 1──* canvas_node
terminal_session 1──? canvas_node
```
