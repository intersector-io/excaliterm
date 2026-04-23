# Infinite Canvas — Technical

## Rendering

Implemented with `@xyflow/react`. Node types are registered in `components/canvas/InfiniteCanvas.tsx`, each mapped to a custom React component (`TerminalNode`, `EditorNode`, `NoteNode`, `HostNode`, `ScreenshotNode`, `ScreenShareNode`, `CommandHistoryNode`).

## Data model

Two tables drive the canvas (`apps/backend/src/db/schema.ts`):

### `canvas_node`

| Column | Notes |
|---|---|
| `id` | PK |
| `workspaceId` | FK |
| `nodeType` | `terminal` \| `note` \| `host` \| `screenshot` \| `editor` \| `command-history` |
| `terminalSessionId`, `noteId`, `screenshotId`, `serviceInstanceId` | Nullable FKs, cascade on delete |
| `x`, `y` | Position (float) |
| `width`, `height` | Size, defaults `600x400` |
| `zIndex` | Int, layering |
| `createdAt`, `updatedAt` | Timestamps |

### `canvas_edge`

| Column | Notes |
|---|---|
| `id` | PK |
| `workspaceId` | FK |
| `sourceNodeId`, `targetNodeId` | FKs to `canvas_node` with CASCADE |

Edges connect: terminal→host, editor→host, terminal→screenshot, terminal→screen-share, terminal→command-history.

## REST endpoints

- `GET /api/w/:workspaceId/canvas/nodes` — list every node.
- `PATCH /api/w/:workspaceId/canvas/nodes/:id` — update `x`, `y`, `width`, `height`, `zIndex`.
- `DELETE /api/w/:workspaceId/canvas/nodes/:id` — delete one node (does not cascade related records).
- `GET /api/w/:workspaceId/canvas/edges` — list edges.
- `DELETE /api/w/:workspaceId/canvas/edges/:id` — delete an edge.

Nodes of specific kinds (terminals, notes, screenshots, editors, command-history) are created through their respective feature endpoints, which also insert the backing `canvas_node` and `canvas_edge` rows in one transaction.

## SignalR hub — `CanvasHub`

Broadcast-only methods to the workspace group:

- `NodeAdded(CanvasNodeDto)`
- `NodeMoved(nodeId, x, y)`
- `NodeResized(nodeId, width, height)`
- `NodeRemoved(nodeId)`

Backed by Redis pub/sub on channel `canvas:updates`.

## Auto layout

`apps/frontend/src/lib/dagre-layout.ts` wraps `dagre` to compute top-down hierarchical positions using the edges graph. The result is applied by bulk-PATCHing each node.

## Focused-terminal URL hash

`#focus=<terminalId>` is read/written in `InfiniteCanvas.tsx` (desktop) and `MobileTerminalListView.tsx` (mobile) via `window.location.hash`, persisting the open-fullscreen state across reloads and shares.

## Auto grid positions for new nodes

- Terminals: 3-column grid, cell `760x480`, origin `(72, 76)`, gap `40` (`routes/terminals.ts`).
- Hosts: horizontal row of `280x160` cells at `y=76`, spaced `60` px.
- Screenshots: below the source terminal (`y + height + 60`).
- Command history: to the right of the source terminal, size `380x420`.

## Key files

- `apps/backend/src/routes/canvas.ts`
- `apps/backend/src/db/schema.ts` (`canvas_node`, `canvas_edge`)
- `apps/backend/src/lib/mappers.ts`
- `apps/signalr-hub/Excaliterm.Hub/Hubs/CanvasHub.cs`
- `apps/frontend/src/components/canvas/InfiniteCanvas.tsx`
- `apps/frontend/src/components/canvas/CanvasToolbar.tsx`
- `apps/frontend/src/lib/dagre-layout.ts`
- `apps/frontend/src/hooks/use-canvas.ts`
