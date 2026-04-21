# CDP Browser Preview - Implementation Plan

## Context

When a PowerShell session on the host machine opens Chrome (e.g., `start http://localhost:3000`), the user currently sees nothing in the frontend. They want to see the page rendered live on the React Flow canvas, including navigation sync -- when Chrome navigates from page A to page B on the host, the preview updates accordingly.

The solution: connect to Chrome via Chrome DevTools Protocol (CDP), stream screenshots and navigation events through SignalR to the frontend, and render them in a new `BrowserNode` canvas component.

## Data Flow

```
Chrome (host)
  --CDP WebSocket-->  terminal-agent (BrowserManager)
    --SignalR-->  TerminalHub (.NET)
      --broadcast-->  Frontend (BrowserNode)
```

## Implementation

### 1. Shared Types (`packages/shared-types/src/signalr.ts`, `models.ts`)

Add browser event interfaces and method constants:

```typescript
// signalr.ts - add to existing file
export interface BrowserOpenedEvent {
  browserId: string;
  url: string;
  title: string;
}
export interface BrowserNavigatedEvent {
  browserId: string;
  url: string;
  title: string;
}
export interface BrowserScreencastEvent {
  browserId: string;
  data: string;       // base64 JPEG
  timestamp: number;
}
export interface BrowserClosedEvent {
  browserId: string;
}
export const BrowserHubMethods = {
  BrowserOpened: "BrowserOpened",
  BrowserNavigated: "BrowserNavigated",
  BrowserScreencast: "BrowserScreencast",
  BrowserClosed: "BrowserClosed",
  BrowserNavigate: "BrowserNavigate",
  BrowserReload: "BrowserReload",
  BrowserGoBack: "BrowserGoBack",
  BrowserGoForward: "BrowserGoForward",
  BrowserClose: "BrowserClose",
} as const;
```

```typescript
// models.ts - add BrowserSession
export interface BrowserSession {
  id: string;
  url: string;
  title: string;
  status: "active" | "closed";
}
```

Add `browserSessionId` to `CanvasNode` interface in `models.ts`.

### 2. Terminal Agent - Browser Module

**New dep**: `chrome-remote-interface` in `apps/terminal-agent/package.json`

**New file: `apps/terminal-agent/src/browser/detector.ts`**
- Scans raw terminal output for URL-opening commands
- Patterns: `start\s+(https?://\S+)` (Windows), `open\s+(https?://\S+)` (macOS), `xdg-open\s+(https?://\S+)` (Linux)
- Debounce: skip same URL within 2 seconds
- Returns detected URLs via callback

**New file: `apps/terminal-agent/src/browser/manager.ts`**
- `BrowserManager` class mirroring `TerminalManager` pattern
- `Map<string, BrowserSession>` for active sessions
- Event callbacks: `onOpened`, `onNavigated`, `onScreencast`, `onClosed`
- Key methods:
  - `launchAndConnect(url)` -- spawns `chrome.exe --remote-debugging-port=0 --user-data-dir=<temp> <url>`, parses debug port from stderr, connects via CDP
  - `navigate(browserId, url)` -- `Page.navigate`
  - `reload(browserId)` -- `Page.reload`
  - `goBack/goForward(browserId)` -- `Page.goBack/goForward` (runtime eval `history.back()`)
  - `close(browserId)` -- `Browser.close`, emit `onClosed`
  - `destroyAll()` -- cleanup on shutdown
- CDP event wiring:
  - `Page.frameNavigated` -> `onNavigated(browserId, url, title)`
  - `Page.startScreencast` with `format: "jpeg", quality: 40, maxWidth: 1280, maxHeight: 720, everyNthFrame: 2`
  - `Page.screencastFrame` -> ack frame + `onScreencast(browserId, base64data, timestamp)`
  - CDP disconnect -> `onClosed(browserId)`

**Modified: `apps/terminal-agent/src/hub/terminal-hub.ts`**
- Add `BrowserManager` as constructor parameter
- Wire `BrowserManager` events to hub invocations:
  - `onOpened` -> `hub.invoke("BrowserOpened", browserId, url, title)`
  - `onNavigated` -> `hub.invoke("BrowserNavigated", browserId, url, title)`
  - `onScreencast` -> `hub.invoke("BrowserScreencast", browserId, data, timestamp)`
  - `onClosed` -> `hub.invoke("BrowserClosed", browserId)`
- Register incoming command handlers:
  - `hub.on("BrowserNavigate", (browserId, url) => browserManager.navigate(...))`
  - `hub.on("BrowserReload", ...)`, `hub.on("BrowserGoBack", ...)`, etc.
  - `hub.on("BrowserClose", (browserId) => browserManager.close(...))`

**Modified: `apps/terminal-agent/src/index.ts`**
- Create `BrowserManager` and `BrowserDetector`
- Pass `BrowserManager` to `TerminalHubConnection`
- Tap into terminal output: when `manager.onOutput` fires, also feed `detector.scan(data)`
- When detector finds a URL, call `browserManager.launchAndConnect(url)`
- Add `browserManager.destroyAll()` to shutdown sequence

### 3. SignalR Hub (.NET)

**Modified: `apps/signalr-hub/Excaliterm.Hub/Models/HubModels.cs`**
```csharp
// Add browser records
public record BrowserOpenedMessage(string BrowserId, string Url, string Title);
public record BrowserNavigatedMessage(string BrowserId, string Url, string Title);
public record BrowserScreencastMessage(string BrowserId, string Data, double Timestamp);
public record BrowserClosedMessage(string BrowserId);
```

**Modified: `apps/signalr-hub/Excaliterm.Hub/Hubs/TerminalHub.cs`**

Add agent-to-client methods (follow exact `TerminalOutput`/`TerminalCreated` pattern):
- `BrowserOpened(browserId, url, title)` -- guard with `IsServiceConnection()`, register in `ServiceRegistry` (reuse terminal routing), broadcast to `OthersInGroup`
- `BrowserNavigated(browserId, url, title)` -- broadcast to `OthersInGroup`
- `BrowserScreencast(browserId, data, timestamp)` -- broadcast to group (NO Redis buffering)
- `BrowserClosed(browserId)` -- unregister from `ServiceRegistry`, broadcast to `OthersInGroup`

Add client-to-agent routing methods (follow `TerminalInput` pattern):
- `BrowserNavigate(browserId, url)` -- lookup service via `GetConnectionForTerminal(browserId)`, route to agent
- `BrowserReload(browserId)` -- same routing
- `BrowserGoBack(browserId)` / `BrowserGoForward(browserId)` -- same routing
- `BrowserClose(browserId)` -- same routing

**Modified: `apps/signalr-hub/Excaliterm.Hub/Program.cs`**
- Increase max SignalR message size for screenshot frames:
  ```csharp
  builder.Services.AddSignalR(options => {
      options.MaximumReceiveMessageSize = 512 * 1024; // 512KB
  });
  ```

### 4. Backend

**Modified: `apps/backend/src/db/schema.ts`**
- Add `browserSessionId` column to `canvasNode` table (nullable text, same pattern as `noteId`)

**Modified: `packages/shared-types/src/models.ts`**
- Add `browserSessionId?: string | null` to `CanvasNode` interface

**Modified: `apps/backend/src/routes/canvas.ts`** (or new `browsers.ts`)
- Allow creating canvas nodes with `nodeType: "browser"` and `browserSessionId`
- No new table needed -- browser sessions are lightweight and ephemeral, tracked only via canvas nodes

### 5. Frontend

**New file: `apps/frontend/src/stores/browser-store.ts`**
```typescript
interface BrowserSession {
  url: string;
  title: string;
  frame: string | null;  // latest base64 JPEG (only 1 stored)
  status: "active" | "closed";
}
interface BrowserState {
  sessions: Map<string, BrowserSession>;
  addSession(browserId: string, url: string, title: string): void;
  updateNavigation(browserId: string, url: string, title: string): void;
  updateFrame(browserId: string, data: string): void;
  removeSession(browserId: string): void;
}
```

**New file: `apps/frontend/src/hooks/use-browser.ts`**
- Subscribe to SignalR events on terminal hub: `BrowserOpened`, `BrowserNavigated`, `BrowserScreencast`, `BrowserClosed`
- On `BrowserOpened`: add to store, create canvas node via API (`POST /api/w/:id/canvas/nodes` with `nodeType: "browser"`, `browserSessionId`), invalidate canvas queries
- On `BrowserScreencast`: update frame in store (use `requestAnimationFrame` to coalesce)
- On `BrowserNavigated`: update URL/title in store
- On `BrowserClosed`: update status in store
- Expose actions: `navigate(browserId, url)`, `reload(browserId)`, `goBack(browserId)`, `goForward(browserId)`, `closeBrowser(browserId)`

**New file: `apps/frontend/src/components/canvas/BrowserNode.tsx`**
- Follow `TerminalNode` pattern: `NodeResizer`, `Handle` (top/bottom), drag handle
- Layout:
  - Title bar: traffic light buttons (close calls `closeBrowser`), drag handle, browser ID
  - URL bar: input field with current URL, navigation buttons (back/forward/reload), Enter to navigate
  - Content area: `<img src={data:image/jpeg;base64,...}>` showing latest screencast frame
  - All wrapped in same styling as TerminalNode (rounded-xl, border, shadow)
- Use `nodrag nopan nowheel` on content area for proper interaction
- Memoized with `React.memo`

**Modified: `apps/frontend/src/hooks/use-canvas.ts`**
- Add `BrowserNodeData` interface:
  ```typescript
  export interface BrowserNodeData {
    browserId: string;
    url: string;
    title: string;
    label: string;
    status: "active" | "closed";
    [key: string]: unknown;
  }
  ```
- Extend `AnyNodeData = TerminalNodeData | NoteNodeData | BrowserNodeData`
- Update `canvasNodeToFlowNode` to handle `nodeType === "browser"` case

**Modified: `apps/frontend/src/components/canvas/InfiniteCanvas.tsx`**
- Import `BrowserNode`
- Add to `nodeTypes`: `browser: BrowserNode`

### 6. Performance Considerations

- **Screencast**: JPEG quality 40, max 1280x720, skip every other frame (~15fps effective)
- **SignalR message size**: Increase to 512KB (frames are ~30-80KB base64)
- **No Redis buffering** for screencast frames -- they're ephemeral, only latest matters
- **Frontend frame coalescing**: Use `requestAnimationFrame` to only render the most recent frame per animation tick
- **Memory**: Store only 1 frame per browser session in Zustand (~100KB each)

## File Summary

| File | Action |
|---|---|
| `packages/shared-types/src/signalr.ts` | Modify |
| `packages/shared-types/src/models.ts` | Modify |
| `apps/terminal-agent/package.json` | Modify (add `chrome-remote-interface`) |
| `apps/terminal-agent/src/browser/detector.ts` | **Create** |
| `apps/terminal-agent/src/browser/manager.ts` | **Create** |
| `apps/terminal-agent/src/hub/terminal-hub.ts` | Modify |
| `apps/terminal-agent/src/index.ts` | Modify |
| `apps/signalr-hub/.../Models/HubModels.cs` | Modify |
| `apps/signalr-hub/.../Hubs/TerminalHub.cs` | Modify |
| `apps/signalr-hub/.../Program.cs` | Modify |
| `apps/backend/src/db/schema.ts` | Modify |
| `apps/frontend/src/stores/browser-store.ts` | **Create** |
| `apps/frontend/src/hooks/use-browser.ts` | **Create** |
| `apps/frontend/src/components/canvas/BrowserNode.tsx` | **Create** |
| `apps/frontend/src/hooks/use-canvas.ts` | Modify |
| `apps/frontend/src/components/canvas/InfiniteCanvas.tsx` | Modify |

## Build Sequence

1. Shared types (both frontend and agent depend on these)
2. Backend schema migration (add `browserSessionId` column)
3. SignalR hub (models + hub methods + message size config)
4. Terminal agent (browser module + hub wiring)
5. Frontend (store + hook + component + canvas registration)

## Verification

1. Start all services (backend, signalr-hub, terminal-agent, frontend)
2. Create a terminal in the frontend canvas
3. In the terminal, run `start http://localhost:3000` (or any URL)
4. Verify: a BrowserNode appears on the canvas showing the page screenshot
5. Navigate in Chrome on the host (click links, type URLs) -- verify the BrowserNode URL bar and screenshot update
6. Type a URL in the BrowserNode URL bar and press Enter -- verify Chrome navigates
7. Click back/forward/reload buttons in BrowserNode -- verify Chrome responds
8. Close Chrome on the host -- verify BrowserNode shows "closed" status
9. Click close on BrowserNode -- verify Chrome closes on host
