# @excaliterm/mcp-tools

A stdio-based MCP server that lets any MCP-aware agent (Claude Code, Claude Desktop, Cursor, …) read and write any terminal in an Excaliterm workspace. Use it to wire up "supervisor" patterns where one agent observes and drives another terminal.

## Install

```bash
npm install -g @excaliterm/mcp-tools
```

## Configure

Generate `~/.excaliterm/mcp.json` from the canvas: click **Connect an agent** in the workspace toolbar, pick the terminals and HTTP triggers you want to expose, copy the produced JSON.

The format:

```json
{
  "baseUrl": "https://your-excaliterm-host",
  "terminals": {
    "worker":     { "id": "…", "readToken": "…" },
    "supervisor": { "id": "…", "readToken": "…" }
  },
  "triggers": {
    "worker": { "id": "…", "token": "…" }
  }
}
```

Friendly names (`worker`, `supervisor`) are what the agent uses; the UUIDs and tokens stay private to the MCP layer.

## Wire into Claude Code

```json
{
  "mcpServers": {
    "excaliterm": {
      "command": "excaliterm-mcp",
      "env": { "EXCALITERM_CONFIG": "~/.excaliterm/mcp.json" }
    }
  }
}
```

## Tools exposed

### `read_terminal({ name, lines? })`

Returns the last N lines of output from the named terminal. `lines` defaults to 200, max 1000.

```
read_terminal(name="worker", lines=50)
```

### `send_terminal({ name, command, requireIdleSec? })`

Sends a command (with trailing Enter) to the terminal mapped to the named HTTP trigger.

Optional `requireIdleSec`: if set, the call returns an error when the terminal has produced output within the last N seconds. Useful for agentic loops that should only nudge an idle worker.

```
send_terminal(name="worker", command="git status -sb")
send_terminal(name="worker", command="continue", requireIdleSec=10)
```

## Supervisor pattern

Drop two terminals on a workspace canvas:

- **Terminal A** runs your real workload (`pnpm dev`, an LLM coding agent, a long-running script).
- **Terminal B** runs Claude Code with this MCP loaded. Tell it to monitor Terminal A.

Example prompt for Terminal B:

```
You are responsible for keeping `worker` healthy. Every 2 minutes, call
read_terminal(name="worker"). If the dev server appears stuck (no progress
for 30s) or has corrupted cache errors, restart it via send_terminal.
Otherwise, do nothing. Continue indefinitely.
```

Now Terminal B has eyes on Terminal A and can fix it without you.

## License

MIT.
