# Terminal Dock — Technical

Desktop-only component rendered by `components/canvas/TerminalDock.tsx`.

## Grouping & filtering

`apps/frontend/src/lib/terminal-grouping.ts` groups terminals by `tag`, `host` (service display name), or `status`. Tag grouping uses the first tag; untagged terminals fall into an "Untagged" bucket.

Search filters by substring match on terminal ID and tag names.

## Navigation

- Single-click calls the `@xyflow/react` `setCenter(x, y, { zoom, duration })` helper, using the node's position from `useCanvas()`.
- Double-click sets the `#focus=<terminalId>` URL hash to open fullscreen.
- Collapse state is persisted in local storage.

## Rendering

Skeleton cards show:

- Short terminal ID
- Status dot (re-using `lib/terminal-status.ts`)
- Tag chip(s) with hash-based color
- Host name

No REST calls of its own; it consumes the shared `useTerminals()` and `useServices()` query hooks.

## Key files

- `apps/frontend/src/components/canvas/TerminalDock.tsx`
- `apps/frontend/src/lib/terminal-grouping.ts`
- `apps/frontend/src/lib/terminal-status.ts`
