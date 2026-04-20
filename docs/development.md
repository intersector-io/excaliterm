# Development Guide

## Monorepo Structure

```
terminal-proxy/
├── apps/
│   ├── backend/              # Node.js backend (Hono + WebSocket)
│   │   ├── src/
│   │   │   ├── auth/         # Better Auth setup and middleware
│   │   │   ├── db/           # Drizzle ORM schema and initialization
│   │   │   ├── routes/       # REST API route handlers
│   │   │   ├── ws/           # WebSocket handlers (client + service)
│   │   │   ├── env.ts        # Zod-validated environment config
│   │   │   └── index.ts      # App entry point
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   ├── frontend/             # React SPA (Vite)
│   │   ├── src/
│   │   │   ├── components/   # React components (canvas, terminal, UI)
│   │   │   ├── hooks/        # Custom React hooks
│   │   │   ├── lib/          # Utility functions
│   │   │   ├── stores/       # Zustand state stores
│   │   │   ├── styles/       # Global CSS / Tailwind config
│   │   │   ├── types/        # TypeScript type definitions
│   │   │   ├── App.tsx       # Root component
│   │   │   └── main.tsx      # Entry point
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   └── windows-service/      # .NET 8 Windows Service
│       ├── TerminalProxy.Service/
│       │   ├── Configuration/ # ServiceOptions
│       │   ├── Models/        # WebSocket message models
│       │   ├── Terminal/      # ConPTY terminal management
│       │   ├── WebSocket/     # Backend connection and message handling
│       │   ├── Worker.cs      # Background service entry point
│       │   ├── Program.cs     # Host builder and DI configuration
│       │   └── appsettings.json
│       └── TerminalProxy.Service.Tests/
│
├── packages/
│   └── shared-types/         # Shared TypeScript type definitions
│       ├── api.ts            # REST API request/response types
│       ├── models.ts         # Domain model types
│       ├── protocol.ts       # WebSocket message types
│       └── index.ts          # Re-exports
│
├── docker-compose.yml
├── package.json              # Root workspace config
├── pnpm-workspace.yaml       # pnpm workspace definition
└── turbo.json                # Turborepo task configuration
```

## Build System

The project uses **pnpm workspaces** for dependency management and **Turborepo** for task orchestration.

### Workspace Packages

| Package                        | Name in `package.json`          |
|--------------------------------|---------------------------------|
| `apps/backend`                 | `@terminal-proxy/backend`       |
| `apps/frontend`                | `@terminal-proxy/frontend`      |
| `packages/shared-types`        | `@terminal-proxy/shared-types`  |

Both the backend and frontend depend on `@terminal-proxy/shared-types` via `workspace:*`.

### Turborepo Tasks

Defined in `turbo.json`:

| Command       | Description                                          |
|---------------|------------------------------------------------------|
| `pnpm dev`    | Start all dev servers concurrently (persistent)      |
| `pnpm build`  | Build all packages (respects dependency order)       |
| `pnpm test`   | Run tests in all packages                            |
| `pnpm lint`   | Run linting in all packages                          |
| `pnpm clean`  | Remove build artifacts from all packages             |

The `build` and `test` tasks have `dependsOn: ["^build"]`, meaning `shared-types` is built before dependent packages.

### Running a Single Package

```bash
# Run only the backend
pnpm --filter @terminal-proxy/backend dev

# Build only the frontend
pnpm --filter @terminal-proxy/frontend build

# Test only the backend
pnpm --filter @terminal-proxy/backend test
```

## Adding Shared Types

Shared TypeScript types live in `packages/shared-types/`. These are used by both the backend and frontend.

1. Add or modify types in the appropriate file:
   - `protocol.ts` -- WebSocket message types
   - `api.ts` -- REST API request/response types
   - `models.ts` -- Domain model types

2. Export from `index.ts` if adding a new file.

3. Rebuild the package:
   ```bash
   pnpm --filter @terminal-proxy/shared-types build
   ```

4. The types are now available in backend and frontend via:
   ```typescript
   import { SomeType } from "@terminal-proxy/shared-types";
   ```

In dev mode (`pnpm dev`), changes to shared-types require a manual rebuild since the package uses `tsc` with no watch mode by default.

## Running Tests

### JavaScript/TypeScript Tests

Both the backend and frontend use **Vitest** as their test runner.

```bash
# Run all tests
pnpm test

# Run backend tests only
pnpm --filter @terminal-proxy/backend test

# Run frontend tests only
pnpm --filter @terminal-proxy/frontend test

# Run with watch mode (during development)
cd apps/backend && pnpm vitest
cd apps/frontend && pnpm vitest
```

### .NET Tests

The Windows Service has a test project at `apps/windows-service/TerminalProxy.Service.Tests/`.

```bash
cd apps/windows-service
dotnet test
```

## Code Style and Conventions

### TypeScript (Backend + Frontend)

- **TypeScript** with strict mode enabled.
- **ES modules** (`"type": "module"` in package.json).
- **Import extensions**: Use `.js` extensions in backend imports (required for ESM resolution with tsc output).
- **Naming**: camelCase for variables/functions, PascalCase for types/interfaces/components.
- **Comments**: Use section separators (`// --- Section ---`) for logical code groupings.

### C# (Windows Service)

- **.NET 8** with nullable reference types and implicit usings enabled.
- **File-scoped namespaces** (single namespace per file).
- **Records** for immutable data (message payloads).
- **Dependency injection** via `Microsoft.Extensions.DependencyInjection`.
- **Naming**: PascalCase for public members, `_camelCase` for private fields.

### General

- Keep shared type definitions in `packages/shared-types` -- do not duplicate types.
- All database access goes through Drizzle ORM in the backend.
- WebSocket message types are string literals prefixed with their direction (`client:`, `server:`, `service:`, `backend:`).

## Adding New shadcn/ui Components

The frontend uses [shadcn/ui](https://ui.shadcn.com/) with the following configuration (`components.json`):

```bash
cd apps/frontend

# Add a component (example: button)
npx shadcn@latest add button

# Add multiple components
npx shadcn@latest add card dialog dropdown-menu
```

Components are installed into `apps/frontend/src/components/ui/` and can be customized directly. The project uses Tailwind CSS 4 with the `@tailwindcss/vite` plugin.
