# Hosts & Services — Technical

A "host" is a `service_instance` row in the DB plus a live SignalR connection from the `excaliterm` CLI.

## Data model

Table `service_instance`:

| Column | Notes |
|---|---|
| `id` | DB PK |
| `serviceId` | Unique public ID used over SignalR; default `<hostname>-<pid>` from the agent |
| `workspaceId` | FK |
| `name` | Editable display name |
| `apiKey` | Copy of the workspace API key used for hub auth |
| `whitelistedPaths` | JSON array, optional file-access limits |
| `status` | `online` \| `offline` |
| `lastSeen` | Last heartbeat/connect |
| `createdAt`, `updatedAt` | Timestamps |

A `canvas_node` row with `nodeType = "host"` is auto-created when a service transitions to online and no host node exists yet (see `apps/backend/src/index.ts` — Redis `service:events` handler).

## REST endpoints

- `GET /api/w/:workspaceId/services` — list.
- `POST /api/w/:workspaceId/services` — register (input: `{ name, whitelistedPaths? }`).
- `PATCH /api/w/:workspaceId/services/:id` — rename / update whitelisted paths.
- `DELETE /api/w/:workspaceId/services/:id` — unregister; cascades host and editor canvas nodes.

## SignalR registration

Both `TerminalHub` and `FileHub` expose `RegisterService(serviceId, apiKey)`. The hub:

1. Validates the API key via `ApiKeyValidator` (5-minute cache; HTTP call to backend `/api/validate-key`).
2. Tracks the connection in `ServiceRegistry` (in-memory).
3. Publishes `{ event: "online", serviceInstanceId, workspaceId }` to Redis channel `service:events`.

On hub disconnect (`OnDisconnectedAsync`) the hub publishes `service:events` with `event: "offline"` and marks all active terminals on that service as `disconnected`.

The backend subscribes to `service:events` and updates `status`, `lastSeen`, and creates the host canvas node. After the DB is consistent it publishes `service:online-ready` (and `canvas:updates` with `nodeAdded` for a freshly created host node); the hub subscribes to those and fans out `ServiceOnline` / `NodeAdded` to the workspace group — so clients never refetch before the new row and node exist.

## Host management from the CLI

The `ShutdownHost()` hub method (declared on `TerminalHubConnection` from the agent side, routed via backend) triggers a platform-specific shutdown command inside the agent process.

## Frontend

- `components/services/RegisterServiceDialog.tsx` — connect-a-host dialog; builds the CLI command string from workspace ID, API key, and `SIGNALR_HUB_URL` (from config). When the workspace API key is missing from `localStorage` (e.g. the current browser didn't create the workspace, or storage was cleared), the dialog renders a recovery state that explains the constraint and offers a "Create new workspace" action instead of showing a broken command.
- `components/services/ServiceCard.tsx`, `ServicesView.tsx` — list and status rendering.
- `components/services/ServiceConfigDialog.tsx` — rename/shutdown/delete.
- `components/canvas/MobileHostsSection.tsx` — mobile section with quick actions.
- `hooks/use-services.ts` — TanStack Query hooks around the REST endpoints.

## Key files

- `apps/backend/src/routes/services.ts`
- `apps/backend/src/index.ts` (Redis `service:events` subscriber)
- `apps/signalr-hub/Excaliterm.Hub/Services/ServiceRegistry.cs`
- `apps/signalr-hub/Excaliterm.Hub/Auth/ApiKeyValidator.cs`
- `apps/signalr-hub/Excaliterm.Hub/Hubs/TerminalHub.cs` (`RegisterService`, `OnDisconnectedAsync`)
- `apps/terminal-agent/src/hub/terminal-hub.ts` / `file-hub.ts` (client-side register + reconnect)
