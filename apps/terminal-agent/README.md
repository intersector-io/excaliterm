# excaliterm

Terminal agent for [Excaliterm](https://github.com/intersector-io/excaliterm) -- connect your machine to a collaborative terminal canvas workspace.

## Install

```bash
npm install -g excaliterm
```

## Usage

```bash
export SIGNALR_HUB_URL="https://your-hub:5000"
export SERVICE_API_KEY="your-shared-secret"
export WORKSPACE_ID="your-workspace-id"
excaliterm
```

Or run without installing:

```bash
npx excaliterm
```

## Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SERVICE_API_KEY` | Yes | -- | Shared secret matching the SignalR hub |
| `SIGNALR_HUB_URL` | No | `http://localhost:5000` | SignalR hub URL |
| `WORKSPACE_ID` | No | null UUID | Workspace ID from the browser URL (`/w/<id>`) |
| `SERVICE_ID` | No | `{hostname}-{pid}` | Stable identifier for this agent |
| `WHITELISTED_PATHS` | No | *(all)* | Comma-separated allowed filesystem paths |
| `SHELL_OVERRIDE` | No | PowerShell (Win) / bash (Unix) | Custom shell executable |

## What It Does

Once connected, the web UI can:

- Create terminal sessions that spawn real shell processes on your machine
- Stream terminal I/O in real-time to all workspace collaborators
- Browse and edit files on your machine (respects `WHITELISTED_PATHS`)

## Running as a Service

```bash
# pm2
pm2 start excaliterm --name my-workspace

# systemd, NSSM, etc. -- see docs
```

## License

MIT
