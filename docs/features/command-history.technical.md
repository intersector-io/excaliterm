# Command History — Technical

## Data model

Table `command_history`:

| Column | Notes |
|---|---|
| `id` | PK |
| `workspaceId` | FK |
| `terminalSessionId` | FK |
| `command` | text (1–1000 chars) |
| `executedAt` | Timestamp |
| `createdAt` | Timestamp |

Index: `(workspaceId, terminalSessionId)`.

## Capture path

The terminal-agent tracks the user's input between newlines and POSTs each completed line to the backend. Commands longer than 1000 characters are rejected.

## REST endpoints

- `POST /api/w/:workspaceId/command-history` — save `{ terminalSessionId, command }`. Validates terminal belongs to the workspace.
- `GET /api/w/:workspaceId/command-history/:terminalSessionId?limit=100` — chronological (newest first).
- `GET /api/w/:workspaceId/command-history/:terminalSessionId/top` — aggregated; returns `{ command, count, lastExecutedAt }[]` (top 10 by COUNT).
- `POST /api/w/:workspaceId/command-history/node` — creates the canvas node (`nodeType = "command-history"`, 380×420, positioned to the right of the source terminal) and an edge to it.

## Re-execute

The "Execute" button on a row calls the terminal hub's `TerminalInput(terminalId, command + "\n")` — subject to the same lock checks as normal typing.

## Frontend

- `components/canvas/CommandHistoryNode.tsx` — node UI with tabs.
- `hooks/use-command-history.ts` — list / top / execute.

## Key files

- `apps/backend/src/routes/command-history.ts`
- `apps/backend/src/db/schema.ts` (`command_history`)
- `apps/frontend/src/components/canvas/CommandHistoryNode.tsx`
- `apps/frontend/src/hooks/use-command-history.ts`
