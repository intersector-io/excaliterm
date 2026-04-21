# Repository Guidelines

## Project Structure & Module Organization
This repo is a `pnpm`/Turborepo monorepo. `apps/frontend` contains the Vite client; organize UI in `src/components`, browser logic in `src/hooks` and `src/lib`, and state in `src/stores`. `apps/backend` is the Hono API with routes in `src/routes`, persistence in `src/db`, and middleware in `src/middleware`. `apps/terminal-agent` runs the PTY/file agent. `apps/signalr-hub/Excaliterm.Hub` is the .NET 8 SignalR bridge. Shared contracts belong in `packages/shared-types/src`. Tests live in `apps/backend/tests` and `apps/frontend/tests`.

## Build, Test, and Development Commands
Run `pnpm install` at the root. Use `pnpm dev` to start workspaces, `pnpm build` to build them, and `pnpm test` for all suites. For focused work, use `pnpm --filter @excaliterm/backend test`, `pnpm --filter @excaliterm/frontend test`, and `pnpm --filter @excaliterm/shared-types build` after changing shared contracts. Build the hub with `dotnet build apps/signalr-hub/Excaliterm.Hub`. Use `docker compose up --build` when you need the containerized stack.

## Coding Style & Naming Conventions
TypeScript is strict and uses ES modules. In backend code, keep relative imports compatible with emitted JS by using `.js` suffixes. In frontend code, prefer the `@/` alias for `src/*`. Match the existing two-space indentation in TS/TSX and four-space indentation in C#. Use `PascalCase` for React components, C# types, and exported models; use `camelCase` for functions, variables, and hooks; keep utility and hook filenames kebab-cased like `signalr-client.ts` and `use-terminal.ts`. No repo-wide formatter or lint config is checked in, so avoid style-only churn.

## Testing Guidelines
Backend tests use Vitest in a Node environment under `apps/backend/tests/**/*.test.ts`. Frontend tests use Vitest + Testing Library in `jsdom`; keep them under `apps/frontend/tests` with names ending in `.test.tsx` or `.test.ts`. Add or update tests whenever you change route behavior, shared state, or interactive UI. There is no enforced coverage gate today, so cover changed paths deliberately.

## Commit & Pull Request Guidelines
This branch currently has no commit history to infer a house style from. Use short, imperative commit messages with a scope, for example `backend: validate workspace access` or `frontend: fix terminal node close flow`. PRs should describe the user-visible change, list affected apps/packages, note any `.env` or Docker impact, link the issue when available, and include screenshots or GIFs for frontend/canvas changes. Always list the commands you ran to verify the work.

## Configuration Notes
Start from `.env.example`; never commit secrets or machine-specific values such as `SERVICE_ID`, `WORKSPACE_ID`, or `WHITELISTED_PATHS`. If a contract is used in more than one TS app, define it in `packages/shared-types`.
