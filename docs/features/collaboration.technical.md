# Collaboration — Technical

All presence state is **in-memory** inside the SignalR hub — nothing is persisted. Rejoining / reloading is lossless because locks auto-release on disconnect and presence is rebuilt from the live connection set.

## In-memory registry

`apps/signalr-hub/Excaliterm.Hub/Services/TerminalCollaborationRegistry.cs`:

- `_collaborators` — per-workspace `ConcurrentDictionary<clientId, CollaboratorInfo { clientId, displayName, joinedAt }>`
- `_terminalLocks` — global `ConcurrentDictionary<terminalId, TerminalLockInfo { workspaceId, terminalId, clientId, displayName, lockedAt }>`
- Typing throttle — per `(terminalId, clientId)` timestamp, 800 ms window

## SignalR — `TerminalHub`

Lifecycle:

- `OnConnectedAsync()` — registers collaborator from the query-string `displayName`, sends `CollaborationStateMessage { collaborators, locks }` to the caller and `CollaboratorJoined { collaborator }` to the rest of the workspace group.
- `OnDisconnectedAsync()` — removes collaborator, force-releases any held locks, broadcasts `CollaboratorLeft { clientId }` and `TerminalLockChanged` for released locks.

Methods:

- `RequestCollaborationState()` — returns the current state to the caller.
- `AcquireTerminalLock(terminalId)` — succeeds only if unlocked; broadcasts `TerminalLockChanged { terminalId, lock: TerminalLockInfo }`.
- `ReleaseTerminalLock(terminalId)` — only the owner can release (unless forced by disconnect).

Typing:

- `TerminalInput` emits `TerminalTyping { terminalId, clientId, displayName, timestamp }` to the workspace group, throttled to one event per 800 ms per (terminal, client).

## Display name

- Frontend stores the current collaborator name in `localStorage` keyed by workspace ID (see `apps/frontend/src/lib/collaborator.ts`).
- `EditableDisplayName` component (`components/ui/editable-display-name.tsx`) updates local storage and reconnects the SignalR hub with the new name in the query string.
- The name also travels in the `ChatMessageDto` and in `SendMessage` calls.

## Frontend state

- `hooks/use-terminal-collaboration.ts` — subscribes to `CollaboratorJoined` / `CollaboratorLeft` / `TerminalLockChanged` / `TerminalTyping`; exposes lock/unlock mutations.
- `stores/terminal-collaboration-store.ts` — Zustand store for collaborator list, lock map, and active-typists set (with timeout eviction).
- Lock UI: cyan ring on owned terminals, disabled state on others.

## Key files

- `apps/signalr-hub/Excaliterm.Hub/Services/TerminalCollaborationRegistry.cs`
- `apps/signalr-hub/Excaliterm.Hub/Hubs/TerminalHub.cs`
- `apps/signalr-hub/Excaliterm.Hub/Models/HubModels.cs` (presence/lock DTOs)
- `apps/frontend/src/hooks/use-terminal-collaboration.ts`
- `apps/frontend/src/stores/terminal-collaboration-store.ts`
- `apps/frontend/src/lib/collaborator.ts`
- `apps/frontend/src/components/ui/editable-display-name.tsx`
