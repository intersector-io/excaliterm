# Production Deployment

## Architecture Overview

```
                    Internet
                       |
              +--------v--------+
              |    nginx (80)   |     Frontend container
              |  Static React   |     serves built SPA
              +--------+--------+
                       |
              +--------v--------+
              | Node.js (3001)  |     Backend container
              |   Hono + WS     |     HTTP API + WebSocket
              |   SQLite DB     |
              +--------+--------+
                       ^
                       | WebSocket (/ws/service)
                       |
              +--------+--------+
              | Windows Service |     Runs on Windows host
              | .NET 8 Worker   |     (not in Docker)
              | ConPTY + PS     |
              +-----------------+
```

The backend and frontend run in Docker containers. The Windows Service runs natively on a Windows host because it requires the Windows ConPTY API.

## Docker Compose Deployment

### 1. Prepare Environment

Create a `.env` file in the project root:

```bash
DATABASE_URL=/app/data/terminal-proxy.db
BETTER_AUTH_SECRET=<generate-a-strong-random-string>
SERVICE_API_KEY=<generate-a-strong-random-string>
FRONTEND_URL=https://your-domain.com
BACKEND_PORT=3001
```

Generate secrets with:

```bash
openssl rand -base64 32
```

### 2. Build and Start

```bash
docker compose up --build -d
```

This starts:
- **backend** on port 3001
- **frontend** on port 5173 (nginx)

The SQLite database is persisted in the `backend-data` Docker volume.

### 3. Verify

```bash
# Check container status
docker compose ps

# Check backend health
curl http://localhost:3001/api/health

# View logs
docker compose logs -f backend
docker compose logs -f frontend
```

## Windows Service Installation

The Windows Service must run on a Windows machine that has network access to the backend.

### 1. Publish the Service

On a machine with the .NET 8 SDK:

```bash
cd apps/windows-service/TerminalProxy.Service
dotnet publish -c Release -r win-x64 --self-contained true -o C:\Services\TerminalProxy
```

### 2. Configure

Edit `C:\Services\TerminalProxy\appsettings.json`:

```json
{
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.Hosting.Lifetime": "Information"
    }
  },
  "ServiceOptions": {
    "BackendWsUrl": "ws://backend-host:3001",
    "ApiKey": "<same-as-SERVICE_API_KEY-in-backend-env>",
    "ServiceId": "prod-machine-01",
    "ReconnectDelayMs": 3000,
    "MaxReconnectDelayMs": 30000
  }
}
```

Replace `backend-host` with the hostname or IP of the machine running the backend container.

### 3. Install and Start

From an elevated command prompt:

```cmd
sc.exe create TerminalProxy binPath="C:\Services\TerminalProxy\TerminalProxy.Service.exe" start=auto displayname="Terminal Proxy Service"
sc.exe start TerminalProxy
```

### 4. Verify

```cmd
sc.exe query TerminalProxy
```

Check backend health to confirm the service is connected:

```bash
curl http://backend-host:3001/api/health
# Should show: "serviceConnected": true
```

## Environment Variables Reference

### Backend (.env)

| Variable             | Production Notes                                              |
|----------------------|---------------------------------------------------------------|
| `DATABASE_URL`       | Use `/app/data/terminal-proxy.db` inside Docker               |
| `BETTER_AUTH_SECRET` | Strong random string (32+ characters). Never reuse across environments. |
| `SERVICE_API_KEY`    | Strong random string. Must match the Windows Service config.  |
| `FRONTEND_URL`      | The public URL of the frontend (used for CORS).               |
| `BACKEND_PORT`       | Default 3001. Must match the Docker port mapping.             |

### Windows Service (appsettings.json)

| Option           | Production Notes                                                  |
|------------------|-------------------------------------------------------------------|
| `BackendWsUrl`   | WebSocket URL to the backend. Use `wss://` if behind TLS proxy.   |
| `ApiKey`         | Must match `SERVICE_API_KEY` in the backend.                      |
| `ServiceId`      | Unique identifier for this machine/instance.                      |

## Security Considerations

### API Keys

- Generate strong, unique values for `BETTER_AUTH_SECRET` and `SERVICE_API_KEY`.
- Never commit secrets to version control. Use `.env` files or environment variable injection.
- Rotate keys periodically and coordinate between backend and Windows Service.

### HTTPS/TLS

In production, terminate TLS at a reverse proxy (nginx, Caddy, or a cloud load balancer):

- Frontend: Serve over HTTPS.
- Backend REST API: Proxy HTTPS to HTTP on port 3001.
- Backend WebSocket: Proxy WSS to WS on port 3001.
- Update `FRONTEND_URL` to use `https://`.
- Update `BackendWsUrl` in the Windows Service to use `wss://` if traffic goes through the TLS proxy.

### Authentication

- Better Auth sessions are cookie-based with `httpOnly` and `secure` flags in production.
- Set `FRONTEND_URL` accurately so that CORS and trusted origins are correctly configured.
- WebSocket client connections (`/ws/client`) authenticate using the same session cookie.
- WebSocket service connections (`/ws/service`) authenticate using the shared API key.

### Database

- SQLite is suitable for single-server deployments. For multi-server setups, consider migrating to PostgreSQL.
- The Docker volume `backend-data` persists the database. Back up the volume regularly.
- The database file contains hashed passwords and session tokens.

### Network

- Only expose ports 80/443 (frontend) and 3001 (backend) to the network.
- The Windows Service should connect to the backend over a private or trusted network.
- Consider using a VPN or private network between the Windows Service and backend if they are on separate machines.

## Updating

### Backend and Frontend

```bash
# Pull latest code
git pull

# Rebuild and restart containers
docker compose up --build -d
```

The SQLite database is preserved in the Docker volume across rebuilds.

### Windows Service

1. Stop the service: `sc.exe stop TerminalProxy`
2. Publish the new build to the same directory (overwrite existing files).
3. Start the service: `sc.exe start TerminalProxy`

## Monitoring

- **Health endpoint**: Poll `GET /api/health` to verify backend and service connectivity.
- **Docker logs**: `docker compose logs -f` for backend and frontend output.
- **Windows Event Viewer**: Check Application logs for `TerminalProxyService` entries.
- **WebSocket reconnection**: The Windows Service logs reconnection attempts. Frequent reconnections may indicate network issues.
