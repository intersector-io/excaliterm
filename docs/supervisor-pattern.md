# Supervisor pattern — real-world walkthrough

A step-by-step guide for the headline use case: running a coding agent (Claude Code, Codex, Aider, …) on a remote machine while your local Claude Desktop or Claude Code supervises it through Excaliterm.

The scenario below is concrete: you have a project on a Linux dev box, you want **Claude Code (worker)** to implement a feature on that box, while **Claude Desktop (supervisor)** on your laptop watches it, corrects it when it goes off track, and runs its own filesystem checks.

## What you end up with

```
┌─ Your laptop ──────────────┐         ┌─ Linux dev box ──────────────┐
│  Claude Desktop            │  HTTPS  │  excaliterm CLI              │
│  + @excaliterm/mcp-tools   │ ──────▶ │   ├─ terminal: claude_worker │
│  (the supervisor)          │         │   └─ terminal: shell_sidecar │
└────────────────────────────┘         └──────────────────────────────┘
            ▲
            │ open canvas in browser
            ▼
   excaliterm.com/w/<id>  ← you watch the whole loop here
```

The supervisor sends natural-language instructions to `claude_worker` and runs `ls` / `git status` / `pnpm test` against `shell_sidecar`. Both terminals live on the same host, so they share a filesystem.

## Prerequisites

- **Dev box** (Linux/macOS/WSL) with the project checked out, Node 20.12+, and the worker CLI installed (`npm install -g @anthropic-ai/claude-code`, or `codex`, `aider`, etc.).
- **Laptop** with Claude Desktop or Claude Code installed.
- A workspace on [excaliterm.com](https://excaliterm.com) — or a self-hosted instance.

## Step 1 — Connect the dev box to a workspace

On excaliterm.com a workspace is created automatically. From the canvas toolbar click **Connect a Host**, copy the command, and paste it on the dev box:

```bash
export SIGNALR_HUB_URL="https://hub.excaliterm.com"
export SERVICE_API_KEY="<workspace API key>"
export WORKSPACE_ID="<workspace ID from URL>"
excaliterm --allow ~/projects/my-app
```

The `--allow` flag whitelists the project root so the agent can open files in the editor later. Wait for `Ready and waiting for commands` — the canvas now shows **1 host ready**.

## Step 2 — Run the wizard (the 30-second path)

In the toolbar click **+ Set up an agent → coding agent + sidecar shell**.

Pick:
- **Host** — the dev box you just connected.
- **CLI** — `claude` (or `codex`, `aider`, `custom`).
- **Working directory** — `~/projects/my-app`.
- **Friendly names** — `claude_worker` and `shell_sidecar` (these become the MCP tool argument values).

The wizard will:
1. Spawn two terminal nodes on the canvas.
2. Start `claude` in the first one and a plain bash shell in the second.
3. Attach an HTTP trigger to each.
4. Generate `~/.excaliterm/mcp.json` and a `mcpServers` snippet.
5. Run a round-trip connection test.
6. Hand you a starter system prompt tailored to the CLI you chose.

If your case doesn't fit the wizard's defaults, the manual flow is documented in [features/triggers.user.md](./features/triggers.user.md#supervisor-pattern-claude-code-watching-another-terminal).

## Step 3 — Wire up the supervisor on your laptop

The wizard hands you two artifacts. Save them on the **laptop**, not the dev box.

**`~/.excaliterm/mcp.json`** — the connection map for `@excaliterm/mcp-tools`:

```json
{
  "baseUrl": "https://hub.excaliterm.com",
  "terminals": {
    "claude_worker":  { "id": "…", "readToken": "…" },
    "shell_sidecar":  { "id": "…", "readToken": "…" }
  },
  "triggers": {
    "claude_worker":  { "id": "…", "token": "…" },
    "shell_sidecar":  { "id": "…", "token": "…" }
  }
}
```

**`mcpServers` snippet** — paste into your MCP client config. For Claude Desktop: `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows). For Claude Code: `~/.claude.json` or `.mcp.json` in the project.

```json
{
  "mcpServers": {
    "excaliterm": {
      "command": "npx",
      "args": ["-y", "@excaliterm/mcp-tools"]
    }
  }
}
```

Restart the MCP client. You should now see `read_terminal` and `send_terminal` in its tool list.

## Step 4 — Give the supervisor its system prompt

In your Claude Desktop / Claude Code session, paste the starter prompt the wizard generated. Adjust the project context to match your work. Example:

> You supervise a coding agent running on a Linux dev box.
>
> - `claude_worker` is a Claude Code session in `~/projects/my-app`. Drive it with `send_terminal({name: "claude_worker", command: "<natural-language instruction>"})`. Read its replies with `read_terminal({name: "claude_worker", lines: 200})`.
> - `shell_sidecar` is a plain bash shell on the same machine, same working directory. Use it for `ls`, `cat`, `git status`, `pnpm test`, and any other recon. Drive it with `send_terminal({name: "shell_sidecar", command: "<shell command>"})`.
>
> Never send shell commands to `claude_worker` (they land as chat input) and never send natural-language prompts to `shell_sidecar`.
>
> Today's task: implement `<feature>`. Plan it first, dispatch it to the worker in small steps, after each step read the worker's output **and** verify the result on the sidecar (run tests, check git diff). Stop and ask me if a step looks risky.

## Step 5 — Open the canvas and watch the loop

Open the workspace URL in a browser. You should see:

- the dev box host node with status **ready**,
- two terminal nodes — `claude_worker` and `shell_sidecar` — both live,
- HTTP trigger nodes attached to each, dashed amber edges.

Now ask the supervisor (in your Claude Desktop chat) something like *"start on the task"*. As it runs you'll see:

- the trigger pulse amber every time `send_terminal` fires,
- text appearing in the worker terminal as if the supervisor were typing,
- the worker's reasoning streaming live,
- the sidecar trigger pulsing whenever the supervisor checks `git status` or runs the test suite.

If the worker goes off track, intervene from the canvas — type directly into either terminal, or click the lock icon to take over the prompt entirely. The supervisor sees the new state on its next `read_terminal` call.

## Step 6 — Optional polish

- **Tag the terminals** so they're easy to find on a busy canvas (`role:worker`, `role:sidecar`).
- **Drop a note** with the task description right next to the worker terminal so collaborators joining via URL know what's happening.
- **Add a timer trigger** on the worker with prompt `continue` and the *only when idle for 30s* gate — a Ralph loop that nudges the worker forward without interrupting it.
- **Open an editor node** on the dev box pointed at the project so you can read the diff alongside the terminals.

## Handling worker rate limits

If the worker is itself a Claude / Codex / Aider session, it will eventually hit a usage limit mid-task and print something like *"You've reached your usage limit. Resets at 14:00."* The supervisor is a chat session, not a daemon, so it can't reliably sleep for hours and resume on its own. Three patterns, in order of complexity:

### Option A — Detect and park (manual resume)

Tell the supervisor in its system prompt to recognise the limit message:

> If `read_terminal` on `claude_worker` shows a usage-limit notice, stop dispatching new work. Drop a sticky note on the canvas summarising progress so far and the reset time, then end your turn. When I message you again, re-read both terminals and resume from where you left off.

Bulletproof, no infrastructure — but you have to nudge it after the reset.

### Option B — Timer trigger as a heartbeat (autonomous resume)

Attach a **timer trigger** to the worker terminal with prompt `continue`, interval `5 min`, and the **only when idle for 30s** gate enabled. While the worker is rate-limited the input is rejected harmlessly; once the limit resets the next firing lands and the worker picks up the task on its own.

The supervisor doesn't need to be online for the resume — you just check the canvas later. Trade-off: resumption happens within a 5-minute window of the reset, not instantly, and the prompt is a generic `continue` rather than task-specific context. Pair it with Option A so the supervisor parks a sticky note describing where the worker should pick up.

### Option C — Scheduled HTTP trigger (precise resume)

If the worker prints an exact reset timestamp, register a one-shot call to the worker's **HTTP trigger** at that time from cron-job.org (or any scheduler), with a `continue`-style payload:

```bash
curl -X POST 'https://hub.excaliterm.com/api/triggers/<worker-trigger-id>/fire' \
  -H 'X-Trigger-Token: <secret>' \
  -H 'Content-Type: application/json' \
  -d '{"prompt":"continue with the task: <short summary>"}'
```

Precise to the minute and lets you inject task-specific context, at the cost of an external scheduler dependency. Combine with `X-Trigger-Require-Idle: 30` so the call no-ops if the worker happens to be busy.

### Picking one

- Solo dev, you're around → **A**.
- Long-running unattended job → **B**, with **A** as the fallback note for context.
- Tight resume timing matters (cost-sensitive batch, hand-off across timezones) → **C**.

## When things go wrong

| Symptom | Likely cause | Fix |
|---|---|---|
| Supervisor says it can't see the tools | MCP client not restarted, or `mcp.json` in the wrong place | Restart the client; confirm the path matches your OS |
| `send_terminal` returns 401 | Token rotated or copied wrong | Open the trigger node → Rotate secret → regenerate `mcp.json` from the wizard |
| Commands appear in the wrong terminal | Friendly names swapped | Check the wizard step 2 names match your system prompt |
| Worker output never updates | Host offline | Check the host node status; restart `excaliterm` on the dev box |
| Trigger returns 409 | `X-Trigger-Require-Idle` set and the worker is still typing | Expected — the supervisor should retry after backoff |

## Going further

- [Triggers — full reference](./features/triggers.user.md)
- [Terminals](./features/terminals.user.md)
- [Hosts](./features/hosts.user.md)
- [Setup guide](./setup.md)
