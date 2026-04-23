# Chat — Technical

## Data model

Table `chat_message`:

| Column | Notes |
|---|---|
| `id` | PK (UUID assigned when the SignalR message is broadcast) |
| `workspaceId` | FK |
| `displayName` | text, default `"Anonymous"` |
| `content` | text |
| `createdAt` | Timestamp |

## REST endpoint

- `GET /api/w/:workspaceId/chat?limit=50&offset=0` — paginated history ordered by `createdAt DESC`.

## SignalR — `ChatHub`

### Browser → Hub

- `SendMessage(content)` — constructs a `ChatMessageDto { id, userId, userName, workspaceId, content, timestamp }` and broadcasts `ReceiveMessage` to the workspace group.

### Hub → Browser

- `ReceiveMessage(ChatMessageDto)` — pushed to every client in the workspace.

The hub does not persist messages directly; the backend subscribes to Redis channel `chat:messages` and writes them to SQLite asynchronously.

## Redis channel

- `chat:messages` — backend → hub: `{ workspaceId, message: ChatMessageDto }`.

## Frontend

- `components/chat/ChatView.tsx` — full panel.
- `components/chat/ChatMessageList.tsx` — paginated list with infinite scroll upward.
- `components/chat/ChatInput.tsx` — input with Enter-to-send.
- `hooks/use-chat.ts` — REST history query + SignalR live subscription.
- `stores/chat-store.ts` — message cache + unread counter.
- Keyboard shortcut `Cmd/Ctrl+Shift+C` toggles the panel on desktop.

## Key files

- `apps/backend/src/routes/chat.ts`
- `apps/signalr-hub/Excaliterm.Hub/Hubs/ChatHub.cs`
- `apps/signalr-hub/Excaliterm.Hub/Services/RedisSubscriber.cs` (`chat:messages`)
- `apps/frontend/src/components/chat/`
- `apps/frontend/src/hooks/use-chat.ts`
