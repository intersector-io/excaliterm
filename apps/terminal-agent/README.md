# excaliterm

Terminal agent for [Excaliterm](https://github.com/intersector-io/excaliterm) -- connect your machine to a collaborative terminal canvas workspace.

## Install

```bash
npm install -g excaliterm
```

## Usage

```bash
export SIGNALR_HUB_URL="https://hub.excaliterm.com"
export SERVICE_API_KEY="your-workspace-api-key"
export WORKSPACE_ID="your-workspace-id"
excaliterm --allow /home/app --allow /var/log
```

Positional arguments are shorthand for `--allow`:

```bash
excaliterm ./src ./docs
npx excaliterm --allow /srv/project
```

By default the agent exposes **no** filesystem paths. You must explicitly whitelist directories with `--allow` (repeatable), positional arguments, or the `WHITELISTED_PATHS` env var.

## Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SERVICE_API_KEY` | Yes | -- | Per-workspace API key (from the "Connect a Host" dialog) |
| `SIGNALR_HUB_URL` | No | `http://localhost:5000` | SignalR hub URL |
| `WORKSPACE_ID` | No | null UUID | Workspace ID from the browser URL (`/w/<id>`) |
| `SERVICE_ID` | No | `{hostname}-{pid}` | Stable identifier for this agent |
| `WHITELISTED_PATHS` | No | *(none)* | Comma-separated allowed filesystem paths. Merges with `--allow` flags and positionals. |
| `SHELL_OVERRIDE` | No | PowerShell (Win) / bash (Unix) | Custom shell executable |

## What It Does

Once connected, the web UI can:

- Create terminal sessions that spawn real shell processes on your machine
- Stream terminal I/O in real-time to all workspace collaborators
- Browse and edit files under whitelisted directories only

## Running as a Service

```bash
# pm2
pm2 start excaliterm --name my-workspace

# systemd, NSSM, etc. -- see docs
```

## License

MIT
