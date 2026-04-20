# Development Environment Setup

## Prerequisites

| Tool         | Version    | Notes                                            |
|--------------|------------|--------------------------------------------------|
| Node.js      | 20+        | Required for backend and frontend                |
| pnpm         | Latest     | Package manager (enabled via `corepack enable`)  |
| .NET 8 SDK   | 8.0+       | Required for the Windows Service                 |
| Windows      | 11 or 10 1809+ | ConPTY requires Windows 10 build 1809 or later |
| Docker       | Optional   | For containerized deployment of backend/frontend |

### Verify prerequisites

```bash
node --version    # v20.x or higher
pnpm --version    # 9.x or higher
dotnet --version  # 8.x
```

If pnpm is not available, enable it through Node.js corepack:

```bash
corepack enable
corepack prepare pnpm@latest --activate
```

## Clone and Install

```bash
git clone <repository-url> terminal-proxy
cd terminal-proxy

# Install all JavaScript/TypeScript dependencies
pnpm install
```

This installs dependencies for all workspaces: `apps/backend`, `apps/frontend`, and `packages/shared-types`.

For the Windows Service, restore .NET dependencies:

```bash
cd apps/windows-service/TerminalProxy.Service
dotnet restore
```

## Environment Configuration

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` with your values:

```bash
# Backend
DATABASE_URL=file:./data/terminal-proxy.db
BETTER_AUTH_SECRET=your-secret-here
SERVICE_API_KEY=your-service-api-key-here
FRONTEND_URL=http://localhost:5173
BACKEND_PORT=3001

# Windows Service
BACKEND_WS_URL=ws://localhost:3001/ws/service
```

### Variable Reference

| Variable             | Description                                                                 |
|----------------------|-----------------------------------------------------------------------------|
| `DATABASE_URL`       | SQLite database file path. Created automatically on first run.              |
| `BETTER_AUTH_SECRET` | Secret key used by Better Auth for signing session tokens. Use a long random string. |
| `SERVICE_API_KEY`    | Shared secret between the backend and Windows Service for WebSocket auth.   |
| `FRONTEND_URL`      | URL of the frontend app. Used for CORS and trusted origins.                 |
| `BACKEND_PORT`       | Port the backend HTTP/WS server listens on. Defaults to 3001.              |
| `BACKEND_WS_URL`    | Full WebSocket URL the Windows Service connects to (used in appsettings.json). |

### Windows Service Configuration

The Windows Service reads its configuration from `apps/windows-service/TerminalProxy.Service/appsettings.json`:

```json
{
  "ServiceOptions": {
    "BackendWsUrl": "ws://localhost:3001",
    "ApiKey": "your-service-api-key-here",
    "ServiceId": "my-machine-01",
    "ReconnectDelayMs": 3000,
    "MaxReconnectDelayMs": 30000
  }
}
```

The `ApiKey` value must match `SERVICE_API_KEY` in the backend `.env`.

## Running in Development Mode

### Backend + Frontend (concurrent)

From the project root:

```bash
pnpm dev
```

This runs Turborepo which starts both the backend (`tsx watch src/index.ts` on port 3001) and the frontend (Vite dev server on port 5173) concurrently. It also builds `shared-types` if needed.

### Windows Service

In a separate terminal:

```bash
cd apps/windows-service/TerminalProxy.Service
dotnet run
```

This starts the service as a console application (not as a Windows Service) for development. It will connect to the backend at the WebSocket URL configured in `appsettings.json`.

### Verify everything is working

1. Open `http://localhost:5173` in your browser.
2. Register a new account or sign in.
3. The health check at `http://localhost:3001/api/health` should show `serviceConnected: true` when the Windows Service is running.
4. Create a terminal -- a PowerShell window should appear on the canvas.

## Running with Docker

Docker Compose runs the backend and frontend in containers. The Windows Service must run natively on a Windows host (it uses ConPTY).

```bash
# Build and start backend + frontend
docker compose up --build

# Run in background
docker compose up --build -d
```

This starts:
- **backend** on port 3001 (Node.js)
- **frontend** on port 5173 (nginx serving static files)

The SQLite database is persisted in a Docker volume (`backend-data`).

You still need to run the Windows Service separately on the host machine, configured to connect to the backend at `ws://localhost:3001/ws/service` (or `ws://host.docker.internal:3001/ws/service` if the service runs outside Docker).
