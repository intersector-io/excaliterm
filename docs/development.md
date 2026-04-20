# Development Guide

## Monorepo Layout

```text
apps/
  backend/                 Hono REST API, SQLite access, Redis publishing
  frontend/                React/Vite client
  terminal-agent/          PTY and file agent using SignalR
  signalr-hub/
    TerminalProxy.Hub/     ASP.NET Core SignalR hub

packages/
  shared-types/            Shared TS API and SignalR types
```

## Runtime Responsibilities

### `apps/backend`

- Workspace-scoped REST API
- SQLite persistence through Drizzle
- Redis publish/subscribe for service presence and commands

### `apps/frontend`

- Workspace bootstrap and routing
- Infinite canvas, notes, terminal UI, editor, chat, and services views
- SignalR client connections

### `apps/terminal-agent`

- PTY lifecycle via `node-pty`
- File system read/write/list operations
- Service registration with the terminal and file hubs

### `apps/signalr-hub/TerminalProxy.Hub`

- SignalR endpoints under `/hubs/*`
- Workspace validation and connection grouping
- Realtime collaboration and service routing

### `packages/shared-types`

- REST request and response types
- frontend-side SignalR DTOs and method names

## Common Commands

### Root

```bash
pnpm install
pnpm dev
pnpm build
pnpm test
```

### Targeted workspace commands

```bash
pnpm --filter @terminal-proxy/backend dev
pnpm --filter @terminal-proxy/frontend dev
pnpm --filter @terminal-proxy/terminal-agent dev
pnpm --filter @terminal-proxy/shared-types build
pnpm --filter @terminal-proxy/backend test
pnpm --filter @terminal-proxy/frontend test
dotnet run --project apps/signalr-hub/TerminalProxy.Hub
dotnet build apps/signalr-hub/TerminalProxy.Hub
```

Notes:

- `pnpm dev` only covers pnpm workspaces. The SignalR hub still runs separately.
- `turbo.json` marks `build`, `test`, and `lint` as depending on upstream builds.
- `shared-types` does not run in watch mode by default, so schema changes usually need `pnpm --filter @terminal-proxy/shared-types build`.

## Where to Change Things

### REST API and persistence

- Routes: `apps/backend/src/routes`
- Workspace validation middleware: `apps/backend/src/middleware`
- Database schema: `apps/backend/src/db/schema.ts`
- Redis integration: `apps/backend/src/lib/redis.ts`

### Frontend

- Canvas and UI components: `apps/frontend/src/components`
- Reusable logic: `apps/frontend/src/hooks`
- SignalR client bootstrap: `apps/frontend/src/lib/signalr-client.ts`
- Server-facing fetch wrappers: `apps/frontend/src/lib/api-client.ts`
- Local state: `apps/frontend/src/stores`

### Terminal agent

- Config loading: `apps/terminal-agent/src/config.ts`
- Terminal hub bridge: `apps/terminal-agent/src/hub/terminal-hub.ts`
- File hub bridge: `apps/terminal-agent/src/hub/file-hub.ts`
- PTY management: `apps/terminal-agent/src/terminal`
- Filesystem guardrails: `apps/terminal-agent/src/filesystem`

### SignalR hub

- Hub endpoints: `apps/signalr-hub/TerminalProxy.Hub/Hubs`
- Hub DTOs: `apps/signalr-hub/TerminalProxy.Hub/Models/HubModels.cs`
- Service and presence registries: `apps/signalr-hub/TerminalProxy.Hub/Services`
- Workspace validation: `apps/signalr-hub/TerminalProxy.Hub/Auth`

## Realtime Development Notes

There are two realtime paths in the current design:

1. Browser-to-hub SignalR for terminals, canvas sync, chat, and files
2. Backend-to-hub Redis messages for terminal creation, canvas updates, chat history fanout, and service presence

If the frontend connects but terminal creation does nothing, the first thing to check is whether the hub has Redis enabled.

## Testing

Backend and frontend tests use Vitest:

```bash
pnpm --filter @terminal-proxy/backend test
pnpm --filter @terminal-proxy/frontend test
```

The .NET hub currently has a buildable project in the repo, but no separate test project is checked in.

## Conventions

- Backend TypeScript uses ESM with `.js` import suffixes in source.
- Frontend imports should prefer the `@/` alias for `src/*`.
- Shared contracts belong in `packages/shared-types` when used by more than one TypeScript app.
- Keep TypeScript indentation at two spaces and C# indentation at four spaces.
- Avoid style-only churn; there is no enforced repo-wide formatter config checked in.
