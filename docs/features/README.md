# Feature Documentation

This folder documents every feature in Excaliterm. Each feature has two files:

- **`<feature>.user.md`** — end-user guide: what it does, how to use it, where to find it.
- **`<feature>.technical.md`** — implementation details: components, REST endpoints, SignalR methods, database tables, cross-cutting infrastructure.

For architecture-wide topics (deployment, Redis pub/sub, SignalR hubs, database migrations, authentication, agent discovery) see the "technical-only" documents at the bottom of this index.

## End-user features

| Feature | User guide | Technical |
|---|---|---|
| Workspaces | [workspace.user.md](./workspace.user.md) | [workspace.technical.md](./workspace.technical.md) |
| Infinite canvas | [canvas.user.md](./canvas.user.md) | [canvas.technical.md](./canvas.technical.md) |
| Hosts & services | [hosts.user.md](./hosts.user.md) | [hosts.technical.md](./hosts.technical.md) |
| Terminals | [terminals.user.md](./terminals.user.md) | [terminals.technical.md](./terminals.technical.md) |
| Terminal dock (desktop) | [terminal-dock.user.md](./terminal-dock.user.md) | [terminal-dock.technical.md](./terminal-dock.technical.md) |
| Split terminal view (desktop) | [split-view.user.md](./split-view.user.md) | [split-view.technical.md](./split-view.technical.md) |
| Mobile experience | [mobile-experience.user.md](./mobile-experience.user.md) | [mobile-experience.technical.md](./mobile-experience.technical.md) |
| File editor | [editor.user.md](./editor.user.md) | [editor.technical.md](./editor.technical.md) |
| Sticky notes | [notes.user.md](./notes.user.md) | [notes.technical.md](./notes.technical.md) |
| Chat | [chat.user.md](./chat.user.md) | [chat.technical.md](./chat.technical.md) |
| Command history | [command-history.user.md](./command-history.user.md) | [command-history.technical.md](./command-history.technical.md) |
| Screenshots & screen share | [media.user.md](./media.user.md) | [media.technical.md](./media.technical.md) |
| Collaboration (presence, locks) | [collaboration.user.md](./collaboration.user.md) | [collaboration.technical.md](./collaboration.technical.md) |
| Command palette | [command-palette.user.md](./command-palette.user.md) | [command-palette.technical.md](./command-palette.technical.md) |

## Infrastructure / cross-cutting (technical-only)

| Topic | Document |
|---|---|
| Agent / AI discovery endpoints | [agent-discovery.technical.md](./agent-discovery.technical.md) |
| Deployment, transport, auth, persistence | [infrastructure.technical.md](./infrastructure.technical.md) |

## Related documents

- [../architecture.md](../architecture.md) — high-level architecture
- [../api-reference.md](../api-reference.md) — full REST API
- [../websocket-protocol.md](../websocket-protocol.md) — SignalR protocol
- [../setup.md](../setup.md) / [../development.md](../development.md) — running locally
- [../deployment.md](../deployment.md) — Docker / self-hosting
- [../windows-service.md](../windows-service.md) — terminal agent
