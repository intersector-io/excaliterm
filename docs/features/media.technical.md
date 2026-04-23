# Screenshots & Screen Share — Technical

## Screenshots

### Data model

Table `screenshot`:

| Column | Notes |
|---|---|
| `id` | PK |
| `workspaceId` | FK |
| `serviceInstanceId` | FK, nullable |
| `imageData` | Base64-encoded JPEG |
| `monitorIndex` | Int |
| `width`, `height` | Image dimensions |
| `capturedAt` | Timestamp |
| `createdAt`, `updatedAt` | Timestamps |

### REST endpoints

- `GET /api/w/:workspaceId/canvas/screenshots` — list.
- `POST /api/w/:workspaceId/canvas/screenshots` — insert `screenshot` + `canvas_node` (type `screenshot`) + edge from source terminal. Scales canvas display to a max of 800×600. Body includes the base64 image and source terminal node ID.

### SignalR — `FileHub`

- `ListMonitors(serviceId)` — request → `MonitorListResponse(callerConnectionId, { monitors })`.
- `CaptureScreenshot(serviceId, monitorIndex)` → `ScreenshotResponse(callerConnectionId, { serviceId, imageBase64, monitorIndex, width, height })` (broadcast to workspace group so any client can see).

### Agent side

`apps/terminal-agent/src/screenshot/handler.ts` wraps the `screenshot-desktop` npm package. Display list is cached 30 s; per-monitor JPEG dimensions are cached too. Falls back to the primary display on failure.

## Screen share (WebRTC)

Screen sharing uses **WebRTC signaling over SignalR** with a video track provided by periodic JPEG frame broadcasts.

### SignalR — `FileHub`

Initiation / teardown:

- `StartScreenShare(serviceId, monitorIndex)` — routes to the service, which replies with `ScreenShareOfferResponse(callerConnectionId, { serviceId, sessionId, sdp, type })`.
- `StopScreenShare(serviceId, sessionId)` — routes the stop signal to the service.

Signaling:

- `ScreenShareAnswer(serviceId, sessionId, sdp, type)` — browser → service (SDP answer).
- `ScreenShareIceCandidate(serviceId, sessionId, candidate, sdpMid?, sdpMLineIndex?)` — browser → service ICE.
- `ScreenShareIceCandidateResponse(callerConnectionId, ...)` — service → requesting browser ICE (unicast).

Frame stream:

- `ScreenShareFrameResponse(callerConnectionId, { serviceId, sessionId, imageBase64, width, height })` — service → workspace group. The hub broadcasts to every client so multiple collaborators can watch the same stream.

### Agent side

`apps/terminal-agent/src/screen-share/session.ts` captures at a configurable fps (default 3), drops frames on transient failures (tolerance before aborting), and invokes an `onFrame` callback that ultimately sends `ScreenShareFrameResponse`. Consecutive send failures (>5) cause a frame drop to adapt to downstream pressure.

`apps/terminal-agent/src/screen-share/manager.ts` keeps a map of active sessions and ensures they're closed on shutdown.

## Frontend

- `components/canvas/MonitorPickerDialog.tsx` — monitor selection.
- `components/canvas/ScreenshotNode.tsx` — screenshot canvas node.
- `components/canvas/ScreenShareNode.tsx` — live-stream canvas node (play/pause/stop/fullscreen).
- `components/canvas/MobileMediaViewer.tsx` — mobile gallery.
- `hooks/use-screenshot.ts` — list monitors + capture flow.
- `hooks/use-screen-share.ts` — session lifecycle + WebRTC plumbing.
- `stores/screen-share-store.ts` — current frame state per session.

## Key files

- `apps/backend/src/routes/canvas.ts` (screenshots)
- `apps/signalr-hub/Excaliterm.Hub/Hubs/FileHub.cs` (screenshots + WebRTC signaling)
- `apps/signalr-hub/Excaliterm.Hub/Models/HubModels.cs` (screenshot & screen-share DTOs)
- `apps/terminal-agent/src/screenshot/`
- `apps/terminal-agent/src/screen-share/`
- `apps/frontend/src/components/canvas/Screenshot*.tsx` / `ScreenShare*.tsx`
