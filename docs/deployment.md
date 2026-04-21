# Deployment

## Deployment Topology

```text
Internet
   |
frontend (nginx, :5173 externally, :80 in container)
   |-- /api/*  -> backend
   |-- /hubs/* -> signalr-hub

backend (:3001) <-> redis
signalr-hub (:5000) <-> redis

terminal-agent (host or VM) <-> signalr-hub
```

`docker-compose.yml` currently runs:

- `redis`
- `backend`
- `signalr-hub`
- `frontend`

The terminal agent is deployed separately and is not part of the compose stack.

## Required Configuration

### Backend

| Variable | Example |
|----------|---------|
| `DATABASE_URL` | `/app/data/excaliterm.db` |
| `FRONTEND_URL` | `https://your-domain.example` |
| `BACKEND_PORT` | `3001` |
| `REDIS_URL` | `redis://redis:6379` |

### SignalR hub

The compose stack already sets the hub values through environment variables:

- `Redis__ConnectionString=redis:6379`
- `Redis__Enabled=true`
- `Backend__Url=http://backend:3001`
- `Frontend__Url=http://frontend:80`
- `ASPNETCORE_URLS=http://+:5000`

If you run the hub outside Docker, provide equivalent settings through environment variables or appsettings overrides.

### Terminal agent

| Variable | Example |
|----------|---------|
| `SIGNALR_HUB_URL` | `https://your-domain.example` |
| `SERVICE_API_KEY` | shared-secret-used-by-hub |
| `SERVICE_ID` | `host-a` |
| `WORKSPACE_ID` | workspace-id-from-url |
| `WHITELISTED_PATHS` | `/app,/home,/var/log` |
| `SHELL_OVERRIDE` | `/bin/bash` or `powershell.exe` |

`WORKSPACE_ID` must match the workspace the agent should serve.

## Docker Compose

### Start the stack

```bash
docker compose up --build -d
```

### Check status

```bash
docker compose ps
docker compose logs -f backend
docker compose logs -f signalr-hub
docker compose logs -f frontend
```

### Verify endpoints

```bash
curl http://localhost:3001/api/health
curl http://localhost:5000/health
```

The frontend container exposes port `5173` on the host and proxies:

- `/api/*` to the backend
- `/hubs/*` to the SignalR hub

## Running the Terminal Agent in Production

The repo does not currently include a dedicated service wrapper for `apps/terminal-agent`. In production, run it under a process manager appropriate for the host OS, for example:

- `systemd`
- `pm2`
- `supervisord`
- Windows Task Scheduler or NSSM

A typical production flow is:

1. Build the agent:

```bash
pnpm --filter @excaliterm/terminal-agent build
```

2. Provide the required environment variables.

3. Run:

```bash
node apps/terminal-agent/dist/index.js
```

## Persistence

### SQLite

- The backend stores SQLite data under `/app/data/excaliterm.db` in the container.
- The compose stack persists that path through the `backend-data` volume.

### Redis

- Redis is required for terminal creation and cross-process realtime fanout.
- Treat Redis as part of the critical path, not an optional cache.

## Security Notes

- Protect `SERVICE_API_KEY`; it is the shared secret accepted by the SignalR hub for service registration.
- Workspace URLs act as collaboration entry points. Anyone with a valid workspace ID can currently join that workspace.
- Restrict network access so only expected clients can reach the backend and hub.
- Keep `WHITELISTED_PATHS` as narrow as possible on the terminal agent host.

## Operational Notes

- The backend updates service status from Redis-published presence events.
- If the hub starts with Redis disabled, terminal creation requests from the backend will not reach the terminal agent.
- The REST files endpoint is currently a placeholder; interactive file operations go through the SignalR file hub.
