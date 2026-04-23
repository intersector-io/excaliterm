# File Editor — Technical

The editor has no dedicated SQL table. Editor *nodes* on the canvas are `canvas_node` rows with `nodeType = "editor"` linked to a `service_instance`. File contents are fetched on demand over SignalR.

## REST endpoints

- `POST /api/w/:workspaceId/canvas/editors` — creates the canvas node + edge to host.
- `GET /api/w/:workspaceId/files/tree/:serviceId` — stub route that responds with `{ tree: [], message: "File tree will be proxied via SignalR in a future update" }`. Real file browsing is SignalR-based (below).

## SignalR — `FileHub`

### Browser → Hub → Service

- `ListDirectory(serviceId, path)` — lists directory entries.
- `ReadFile(serviceId, path)` — reads file contents (max 10 MB).
- `WriteFile(serviceId, path, content)` — writes file, creates parent directories if needed.

The hub validates the path (`..` rejection, null-byte rejection, base-path check against `/app`, `/home`, `/var/log`) before routing to the service's `FileHubConnection`.

### Service → Hub → Browser

- `DirectoryListingResponse(callerConnectionId, { serviceId, path, entries })` where `entries` is `FileEntryDto[] = { name, path, isDirectory, size?, modifiedAt? }`.
- `FileContentResponse(callerConnectionId, { serviceId, path, content })`.
- `FileErrorResponse(callerConnectionId, { serviceId, path, error })`.

Routing uses `callerConnectionId` so only the requesting browser receives the response.

## Agent-side path validation

`apps/terminal-agent/src/filesystem/validator.ts`:

- Rejects empty paths, null bytes, literal `..` segments.
- Resolves symlinks when the path exists.
- Enforces prefix match against the configured whitelist (case-insensitive on Windows). The whitelist is built from `WHITELISTED_PATHS` (comma-separated), `--allow <path>` flags, and positional CLI args; an empty whitelist denies all paths.
- Throws on denial; the file hub converts to `FileErrorResponse`.

File I/O is handled by `apps/terminal-agent/src/filesystem/handler.ts` — listings are sorted (directories first, then files, both alphabetical); reads are capped at 10 MB; writes create parent directories with `fs.promises.mkdir({ recursive: true })`.

## Frontend

- `components/editor/EditorView.tsx` — overall layout (sidebar + editor on desktop; toggle on mobile).
- `components/editor/EditorPane.tsx` — Monaco-based code editor with dirty tracking.
- `components/editor/FileTree.tsx` / `FileTreeItem.tsx` — collapsible tree.
- `components/editor/ServiceSelector.tsx` — host dropdown; sorts online first.
- `components/canvas/EditorNode.tsx` — canvas node wrapper.
- `hooks/use-files.ts` — SignalR invocation + response handlers, keyed by `(serviceId, path)`.
- `stores/editor-store.ts` — open-file state per editor instance.

## Key files

- `apps/backend/src/routes/files.ts` / `canvas.ts`
- `apps/signalr-hub/Excaliterm.Hub/Hubs/FileHub.cs`
- `apps/signalr-hub/Excaliterm.Hub/Models/HubModels.cs` (File DTOs)
- `apps/terminal-agent/src/filesystem/`
- `apps/frontend/src/components/editor/`
