# Terminal Proxy

Remote terminal proxy with an infinite canvas UI. Create and manage multiple PowerShell sessions through a browser-based interface with real-time streaming.

## Architecture

```
┌──────────────┐     WebSocket      ┌──────────────┐     WebSocket      ┌──────────────────┐
│   Frontend   │ ◄────────────────► │   Backend    │ ◄────────────────► │ Windows Service  │
│  React SPA   │     REST API       │  Node.js     │                    │   C# Worker      │
│  React Flow  │                    │  Hono + WS   │                    │   ConPTY         │
│  xterm.js    │                    │  SQLite      │                    │   PowerShell     │
└──────────────┘                    └──────────────┘                    └──────────────────┘
```

## Stack

- **Frontend**: React, TypeScript, Vite, Tailwind CSS, shadcn/ui, React Flow, xterm.js, TanStack Query, Zustand
- **Backend**: Node.js, TypeScript, Hono, Drizzle ORM, SQLite, Better Auth, ws
- **Windows Service**: C# .NET 8, Worker Service, ConPTY, System.Net.WebSockets
- **Infrastructure**: Docker Compose, pnpm workspaces, Turborepo

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm 9+
- .NET 8 SDK
- Windows 11 (for the Windows Service)

### Development

```bash
# Install dependencies
pnpm install

# Copy environment config
cp .env.example .env

# Start backend + frontend
pnpm dev

# In another terminal, start the Windows Service
cd apps/windows-service/TerminalProxy.Service
dotnet run
```

### Docker

```bash
# Start backend + frontend
docker compose up

# Windows Service still runs natively
cd apps/windows-service/TerminalProxy.Service
dotnet run
```

### Tests

```bash
# All tests
pnpm test

# Windows Service tests
cd apps/windows-service
dotnet test
```

## Documentation

See the [docs](./docs/) directory for detailed documentation:

- [Architecture](./docs/architecture.md)
- [Setup Guide](./docs/setup.md)
- [WebSocket Protocol](./docs/websocket-protocol.md)
- [API Reference](./docs/api-reference.md)
- [Development Guide](./docs/development.md)
- [Windows Service](./docs/windows-service.md)
- [Deployment](./docs/deployment.md)

## License

Private
