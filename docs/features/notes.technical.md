# Notes — Technical

## Data model

Table `note`:

| Column | Notes |
|---|---|
| `id` | PK |
| `workspaceId` | FK |
| `content` | text, default `""` |
| `createdAt`, `updatedAt` | Timestamps |

Each note is backed by a `canvas_node` row with `nodeType = "note"` and `noteId` FK.

## REST endpoints

- `GET /api/w/:workspaceId/notes` — list.
- `POST /api/w/:workspaceId/notes` — create. Body: `{ content?, x?, y? }`. Creates `note` + `canvas_node` (default size 300×300). Returns `{ note, canvasNode }`.
- `PATCH /api/w/:workspaceId/notes/:id` — update content.
- `DELETE /api/w/:workspaceId/notes/:id` — cascades `canvas_node` deletion.

Position and size changes go through the canvas `PATCH /canvas/nodes/:id` endpoint.

## Frontend

- `components/canvas/NoteNode.tsx` — canvas inline editor + preview.
- `components/canvas/MobileNotesSection.tsx` — mobile list + fullscreen editor.
- `hooks/use-notes.ts` — TanStack Query + debounced content PATCH.

Markdown rendering is done client-side in preview mode.

## Key files

- `apps/backend/src/routes/notes.ts`
- `apps/backend/src/db/schema.ts` (`note`)
- `apps/frontend/src/components/canvas/NoteNode.tsx`
- `apps/frontend/src/components/canvas/MobileNotesSection.tsx`
- `apps/frontend/src/hooks/use-notes.ts`
