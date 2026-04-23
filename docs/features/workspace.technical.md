# Workspaces — Technical

## Data model

Table `workspace` (`apps/backend/src/db/schema.ts`):

| Column | Type | Notes |
|---|---|---|
| `id` | text PK | Short random ID (used in URL `/w/<id>`) |
| `name` | text | Default: `"Untitled workspace"` — editable by users |
| `apiKey` | text | Auto-generated UUID, used for service auth |
| `createdAt` | timestamp | Unix epoch |
| `lastAccessedAt` | timestamp | Updated on every workspace fetch |

## REST endpoints

- `POST /api/workspaces` — auto-generates ID and API key. Returns `{ id, name, apiKey, createdAt, lastAccessedAt }` with status 201.
- `GET /api/workspaces/:id` — returns the workspace object, updates `lastAccessedAt`. Status 200 / 404.
- `PATCH /api/workspaces/:id` — updates the editable display name.
- `GET /api/validate-key?workspaceId=...&apiKey=...` — returns `{ valid: boolean }`. Used by the SignalR hub to authorize service connections (see [infrastructure.technical.md](./infrastructure.technical.md)).

## Middleware

`workspaceMiddleware` (`apps/backend/src/middleware/workspace.ts`) validates that the workspace exists for every `/api/w/:workspaceId/*` route and refreshes `lastAccessedAt`.

## Frontend

- Route `/w/:workspaceId` bootstraps the app; missing workspace auto-creates and redirects.
- `components/canvas/CanvasToolbar.tsx` and `components/layout/Sidebar.tsx` render the editable name using `components/ui/editable-display-name.tsx`.
- Display-name editing uses the `PATCH /api/workspaces/:id` endpoint.

## Key files

- `apps/backend/src/routes/workspaces.ts`
- `apps/backend/src/db/schema.ts`
- `apps/backend/src/middleware/workspace.ts`
- `apps/frontend/src/components/ui/editable-display-name.tsx`
