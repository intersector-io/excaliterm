# Triggers

Triggers are nodes you attach to a terminal to submit input automatically. Two types are supported:

- **Timer** — fires a stored prompt every N minutes.
- **HTTP** — exposes a public webhook URL; calling it submits the prompt from the request payload.

A terminal can have one of each type at the same time.

## Adding a timer trigger

1. Open the dropdown (`⋯`) on a terminal node.
2. Click **Add timer trigger**. A trigger node appears to the right of the terminal, connected by a dashed amber edge.
3. The trigger starts in `paused` state until you give it a prompt and toggle it on.

Only one trigger of each type can exist per terminal. The menu item shows **Timer trigger attached** when you already have one.

## Configuring it

The trigger node has four controls:

- **every N min** — interval stepper, 1 to 1440 minutes.
- **prompt** — the command to run. Multi-line is allowed; a final Enter is appended automatically. Click the maximize icon for the full Monaco editor with language picker.
- **only when idle for Ns** — optional. When checked, the timer skips a firing window if the terminal has produced output within the last N seconds. Lets you build agentic loops (Ralph loop) without injecting "continue" mid-execution. Range: 1–3600 s. Off by default.
- **active / paused** — toggle to enable. You can't enable an empty prompt.

Changes save on blur or when stepping the controls.

The footer shows `next MM:SS` while active. The amber dot pulses while running. If a firing is skipped because the terminal was busy, the trigger silently waits for the next interval — no failed-state banner.

## Manually firing

The `⋯` menu has **Fire now**, which submits the prompt immediately without waiting for the interval. Useful for testing.

## Disabling and removing

- **active / paused** toggle pauses without losing config.
- **Delete trigger** in the `⋯` menu removes the trigger node and its edge.

If the parent terminal is locked by another collaborator, the trigger becomes read-only for everyone else.

## Behavior when offline

If the terminal's host goes offline, the scheduler still fires on schedule but writes fail. The error appears as a small red banner on the trigger node, and the trigger keeps trying.

---

## HTTP trigger

The HTTP trigger turns a terminal into a webhook target. Useful for: CI runs that need to kick off a remote command, scheduled jobs from cron-job.org, manual one-off invocations from Postman / Slack / curl.

### Adding one

1. Open the dropdown (`⋯`) on a terminal node → **Add HTTP trigger**.
2. The node appears with:
   - **Endpoint** — the public URL to POST to. Click the copy icon to copy.
   - **Token** — masked by default. Use the eye icon to reveal, copy icon to copy, rotate icon to generate a new secret. Rotating immediately invalidates the old token.
   - **active / paused** toggle. Paused triggers return `403`.
3. The `⋯` menu has **Copy endpoint**, **Copy cURL**, **Rotate secret**, **Delete trigger**.

### Calling it

Toggle to active, then POST to the endpoint with the token in a header and the prompt in the JSON body. Optionally pass `X-Trigger-Require-Idle: <seconds>` to ask the backend to refuse the call (return 409) if the terminal has produced output within the last N seconds — useful for systems that should only drive an agent when it's idle.

```
curl -X POST 'https://<host>/api/triggers/<id>/fire' \
  -H 'X-Trigger-Token: <secret>' \
  -H 'Content-Type: application/json' \
  -d '{"prompt":"echo hello from webhook"}'
```

The prompt comes **strictly from the payload** — empty body or empty `prompt` returns `400`. The HTTP trigger does not store a default prompt.

### Status codes

| code | meaning |
|---|---|
| 200 | fired; body `{ ok: true, firedAt }` |
| 400 | missing/empty `prompt` in body |
| 401 | wrong or missing `X-Trigger-Token` |
| 403 | trigger is paused |
| 404 | trigger id not found (or it's not an HTTP trigger) |
| 409 | `X-Trigger-Require-Idle: N` was set and the terminal produced output within the last N seconds; body has `lastOutputAt` |
| 429 | rate limit hit (60 calls / 60s per IP per endpoint) |
| 502 | publish to terminal failed (host probably offline) |

### Security notes

The token is stored on the server and revealable inside the workspace because anyone with workspace access can already drive the terminal directly. The token's purpose is to keep the URL safe to share **outside** the workspace. Rotate immediately if you think it's been compromised.

---

## Supervisor pattern (Claude Code watching another terminal)

The HTTP trigger lets external systems **write** to a terminal. Pair it with the public **read** endpoint and you get the interesting trick: one terminal can supervise another.

The npm package `@excaliterm/mcp-tools` ships an MCP server that exposes two tools to any MCP-aware client (Claude Code, Claude Desktop, Cursor):

- `read_terminal(name, lines)` — last N lines of a terminal's output.
- `send_terminal(name, command)` — send a command to a terminal via its HTTP trigger.

### Setup in 3 clicks

1. Open the workspace's **Connect an agent** action in the canvas toolbar.
2. Check the terminals + triggers you want to expose. Friendly names (e.g. `worker`) become tool argument values.
3. Copy the generated `~/.excaliterm/mcp.json` and the `mcpServers` snippet for your MCP client. Paste, restart Claude Code, done.

### What the supervisor does

Drop two terminals on the canvas:

- **Terminal A** runs the workload — `pnpm dev`, a long agent task, a flaky service.
- **Terminal B** runs Claude Code with `@excaliterm/mcp-tools` loaded.

Tell Terminal B's session: *"keep `worker` healthy — call read_terminal every 2 minutes; if the dev server is stuck or the cache is corrupted, send_terminal to restart it."* Walk away.

The whole loop is visible on the canvas. You see Terminal A's workload, Terminal B's reasoning, and the trigger nodes pulse amber every time Claude pokes the worker.

### Per-terminal connection details

For one-off cases (just one terminal, no full multi-target config), open the terminal's `⋯` menu → **Copy connection details…**. The dialog gives you the terminal id, the read token, and a copy-paste-ready `mcp.json` fragment.

### Read endpoint

`GET /api/terminals/:id/output?lines=N` — public, authenticated by `X-Terminal-Read-Token`. Default `lines=200`, max 1000. Returns the last N lines from the terminal's 24-hour Redis output buffer.

| code | meaning |
|---|---|
| 200 | `{ terminalId, lines: [...], totalLines, capturedAt }` |
| 401 | wrong/missing `X-Terminal-Read-Token` |
| 404 | unknown terminal id |
| 429 | rate limit (120 reads/min/IP) |
