# Mobile Experience — Technical

## Breakpoint

Detected by `hooks/use-media-query.ts` at `767px`. `components/layout/AppShell.tsx` branches between desktop (sidebar + canvas + optional chat panel) and mobile (main view + `BottomNav`).

## Components

| Component | Purpose |
|---|---|
| `components/layout/BottomNav.tsx` | Canvas/Chat/Settings tabs; unread chat badge |
| `components/layout/Sidebar.tsx` | Desktop-only left rail |
| `components/canvas/MobileTerminalListView.tsx` | Top-level list with sections, grouping, filtering, `#focus=` sync |
| `components/canvas/MobileHostsSection.tsx` | Hosts section, quick actions, reconnect |
| `components/canvas/MobileNotesSection.tsx` | Notes section with fullscreen editor |
| `components/canvas/MobileMediaViewer.tsx` | Screenshots + live streams gallery |
| `components/terminal/TerminalFullScreen.tsx` | Shared fullscreen; injects mobile-only chrome |
| `components/terminal/VirtualKeyboardBar.tsx` | Two-row on-screen keyboard |
| `components/terminal/TerminalInfoFace.tsx` | Flippable card back-face |

## Hooks

- `hooks/use-media-query.ts` — matchMedia wrapper.
- `hooks/use-visual-viewport.ts` — tracks `visualViewport.height` and orientation, exposes a CSS custom property so fullscreen content doesn't slide under the soft keyboard or browser chrome.
- `hooks/use-speech-recognition.ts` — wraps the Web Speech API (`SpeechRecognition`); gracefully unavailable when the API is missing; streams interim + final transcripts into the terminal.

## Grouping & filtering

`lib/terminal-grouping.ts` is shared with the desktop dock. Mobile adds multi-select filter modals for status + tags, persisted only in component state.

## Swipe & flip

- Swipe uses `touchstart`/`touchmove`/`touchend` in `TerminalFullScreen.tsx`; threshold 60px horizontal.
- Card flip is a CSS transform (`rotateY(180deg)`) driven by boolean state; both faces are rendered simultaneously for animation fidelity.

## CTRL toggle

A local `ctrlArmed` state in `VirtualKeyboardBar` transforms the next key into the corresponding control code (e.g. `C` → `\x03`). The toggle auto-releases after one keypress.

## Bottom nav unread badge

Reads `useChatUnreadCount()` (tracks messages received since last opening chat) and renders a red badge.

## Key files

- `apps/frontend/src/components/layout/`
- `apps/frontend/src/components/canvas/Mobile*.tsx`
- `apps/frontend/src/components/terminal/VirtualKeyboardBar.tsx`
- `apps/frontend/src/hooks/use-media-query.ts`
- `apps/frontend/src/hooks/use-visual-viewport.ts`
- `apps/frontend/src/hooks/use-speech-recognition.ts`
