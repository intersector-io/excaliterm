# Triggers — technical

## Data model

`trigger` table (SQLite):

| column | type | notes |
|---|---|---|
| id | text PK | |
| workspaceId | text FK → workspace | cascade delete |
| terminalNodeId | text FK → canvas_node | cascade delete |
| terminalSessionId | text FK → terminal_session | cascade delete |
| type | text | `"timer"` or `"http"` |
| enabled | integer (boolean) | default 0 |
| config | text (JSON) | timer: `{ intervalMin, prompt, language }` · http: `{ secret }` |
| lastFiredAt | integer (timestamp) | nullable |
| lastError | text | nullable, last fire error |

Unique index on `(terminalNodeId, type)` — enforces one-of-each.

`canvas_node.triggerId` (text, nullable) links a node of type `"trigger"` back to its trigger row. Edge is a normal `canvas_edge` row from terminal node → trigger node.

## REST endpoints

### Workspace-scoped (`/api/w/:workspaceId/triggers`)

- `GET /` — list workspace triggers.
- `POST /` — create. Body: `{ terminalNodeId, type: "timer" | "http", config? }`. For `http`, the server generates `secret` automatically and returns it in `trigger.config.secret`. For `timer`, body may seed `intervalMin/prompt/language`. Validates terminal node belongs to workspace and is type `terminal`. Inserts trigger row, canvas node (`nodeType="trigger"`), and edge.
- `PATCH /:id` — update `enabled` and (for timer) `config`. HTTP trigger's `config` is ignored here — use `/rotate`. Rejects enabling a timer with empty prompt. Re-schedules timers.
- `POST /:id/rotate` — HTTP only. Generates a new secret. Old secret immediately stops working.
- `DELETE /:id` — unschedules (timer), deletes the trigger's canvas node (cascades edge), deletes the trigger row.
- `POST /:id/fire` — manual fire for **timer triggers only**. HTTP triggers reject this with 400 — they fire via the public endpoint.

### Public (`/api/triggers/:id/fire`)

- Mounted **outside** `workspaceMiddleware`. Per-route rate limiter: 60 req / 60s / IP.
- `POST /:id/fire`:
  - 404 if id not found or trigger isn't `type: "http"` (timer triggers are not exposed publicly).
  - Header `X-Trigger-Token` compared to the trigger's secret with `timingSafeEqual`. Mismatch → `401`.
  - `403` if trigger is paused (`enabled: false`).
  - Body: `{ prompt: string }`. Empty/missing → `400`.
  - On success: `{ ok: true, firedAt: ISO }`. On publish failure: `502`.

## In-process scheduler

`apps/backend/src/services/trigger-scheduler.ts`. **Timer triggers only** — the scheduler filters by `type === "timer"` on load and rejects non-timer triggers in `rescheduleTimerTrigger`. Min-heap (sorted array) of `{ id, nextFireAt }` driven by a single `setTimeout`. Reschedules itself after each fire.

### Shared fire helper

`apps/backend/src/services/trigger-fire.ts` exports `executeTriggerWithPrompt(triggerId, prompt)`. Called by:
- the scheduler (passes the timer trigger's stored `config.prompt`)
- the public HTTP route (passes `body.prompt`)

Flow:

1. Single-query lookup (trigger ⨝ terminal_session ⨝ service_instance).
2. If terminal is not `active` or prompt is empty → mark as failed.
3. Otherwise publish to Redis `terminal:commands` with `{ command: "terminal:write", terminalId, serviceInstanceId, workspaceId, data: prompt + "\r" }`.
4. Parallel: update `lastFiredAt`/`lastError` AND publish `trigger:fired` to broadcast.
5. Returns `{ ok, error, firedAt }` to the caller. The scheduler uses it to compute next-fire time; the HTTP route uses it to set the response status.

The scheduler boots from `loadAllTriggers()` in `apps/backend/src/index.ts`, which loads enabled triggers from the DB and computes initial `nextFireAt` from `lastFiredAt + interval` (clamped to ≥ now+1s).

Single-replica only. Multi-replica safety is left as a TODO.

## SignalR plumbing

The hub subscribes to `trigger:fired` (Redis) and broadcasts `TriggerFired` on `CanvasHub` to the workspace group. Frontend (`use-triggers.ts`) listens, updates `lastFiredAt` in the React Query cache, and dispatches to local listeners (used by `TriggerNode` for the flash animation).

The existing `terminal:write` redis branch in `RedisSubscriber.cs` was previously a stub; this work fixes it to forward `command.Data` as `TerminalInput(terminalId, data)` to the agent — the same path used by typing in the terminal UI.

## Frontend

- `TriggerNode.tsx` — thin router; picks `<TimerTriggerBody>` or `<HttpTriggerBody>` based on `trigger.type`.
- `TimerTriggerBody.tsx` — interval stepper, auto-grow prompt textarea, Monaco "open in editor" modal, active/paused, countdown.
- `HttpTriggerBody.tsx` — endpoint URL (read-only, copyable), masked token (eye/copy/rotate), active/paused, last-invoked relative time. URL built via `getApiBaseUrl()` from `lib/config.ts`.
- `useTriggers` — query + mutations (`createTrigger`, `updateTrigger`, `deleteTrigger`, `fireTrigger`, `rotateTrigger`) + `TriggerFired` event subscription (single-instance guard).
- `useCanvas` — adds a `trigger` case to `canvasNodeToFlowNode`, queries triggers, and styles edges that target a trigger node with the dashed amber stroke (works for both types).
- `TerminalNode.tsx` — adds **Add timer trigger** AND **Add HTTP trigger** to the `⋯` menu, each disabled independently when its type is already attached.
- Lock model — both bodies read `useTerminalCollaboration(terminalSessionId).lockedByOther` and disable inputs. The backend does **not** enforce lock state for trigger fires (the scheduler and HTTP endpoint are server-side and lockless by design — locks are about collaborator typing, not automation).

## Files

```
packages/shared-types/src/triggers.ts                      (TriggerType union, HttpTriggerConfig)
apps/backend/src/db/schema.ts                              (trigger table; type enum widened)
apps/backend/src/db/index.ts                               (DDL + ALTER COLUMN)
apps/backend/src/lib/mappers.ts                            (per-type parse/serialize)
apps/backend/src/routes/triggers.ts                        (workspace CRUD + /rotate; type-aware)
apps/backend/src/routes/triggers-public.ts                 (public POST /:id/fire)
apps/backend/src/services/trigger-fire.ts                  (shared executeTriggerWithPrompt)
apps/backend/src/services/trigger-scheduler.ts             (timer-only)
apps/backend/src/index.ts                                  (mount routes + boot scheduler)
apps/signalr-hub/.../Models/HubModels.cs                   (Data on RedisTerminalCommand, TriggerFired)
apps/signalr-hub/.../Services/RedisSubscriber.cs           (forward Data; subscribe trigger:fired)
apps/frontend/src/lib/config.ts                            (getApiBaseUrl)
apps/frontend/src/hooks/use-triggers.ts                    (incl. rotateTrigger)
apps/frontend/src/hooks/use-canvas.ts                      (trigger node + edge styling)
apps/frontend/src/lib/api-client.ts                        (CRUD + fire + rotate)
apps/frontend/src/components/canvas/TriggerNode.tsx        (router)
apps/frontend/src/components/canvas/TimerTriggerBody.tsx   (timer body)
apps/frontend/src/components/canvas/HttpTriggerBody.tsx    (http body)
apps/frontend/src/components/canvas/InfiniteCanvas.tsx     (register node type)
apps/frontend/src/components/canvas/TerminalNode.tsx       (dropdown entries — timer + http)
apps/frontend/src/styles/globals.css                       (trigger pulse + flash keyframes)
```
