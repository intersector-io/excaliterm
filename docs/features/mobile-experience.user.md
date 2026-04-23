# Mobile Experience

On viewports ≤767px the app switches to a dedicated mobile layout optimized for touch.

## Layout

- **Top**: workspace header with the editable display name
- **Main**: vertical list with sections — Hosts, Terminals, Notes, Media
- **Bottom**: tab bar with **Canvas**, **Chat**, **Settings**; Chat shows an unread badge

## Sections

### Hosts

See [hosts.user.md](./hosts.user.md) — connected hosts with quick **Terminal** and **Editor** buttons, plus a **Reconnect** button for offline hosts.

### Terminals

Each terminal is a card with a **colored left border** (derived from its first tag). Tap to open fullscreen.

- **Group toggle** — cycle between Status / Tag / Host grouping.
- **Filter button** — opens a modal with multi-select status and tag filters.
- **Clear filters** button once filters are active.

### Notes

See [notes.user.md](./notes.user.md) — a collapsible section with note previews and fullscreen markdown editing.

### Media

See [media.user.md](./media.user.md) — screenshots and live screen shares in a thumbnail gallery with fullscreen viewing.

## Fullscreen terminal

- **Virtual keyboard bar** (two rows): ESC, TAB, CTRL (toggle modifier), `/`, Enter, ↑↓←→, mic.
- **CTRL toggle** — tap once to arm; the next key is sent with Ctrl (e.g. Ctrl+C).
- **Speech-to-text** — tap the mic; Web Speech API converts your voice into terminal input. Hidden on browsers without Web Speech support.
- **Scroll buttons** — floating chevrons for scrolling output up/down.
- **Flippable card** — tap the rotate icon to flip to the back face showing terminal ID, status, tags, recent commands (with copy/execute), lock toggle, and delete button.
- **Swipe navigation** — swipe left/right (≥60px) in fullscreen to go to the previous/next terminal. Prev/Next chevrons in the header do the same.
- **Visual viewport tracking** — the app follows mobile browser chrome (URL bar) and the soft keyboard so content isn't hidden.

## File editor

The desktop canvas editor node is replaced by a fullscreen overlay editor: tap **Editor** on any host card. The file tree and code editor share the overlay, toggled by a button.

## Chat

The chat panel becomes a full-screen view accessible from the Chat tab in the bottom nav.

## Settings

Placeholder tab — reserved for future workspace settings.

## Responsive switching

The breakpoint is 767px. Resizing the browser across the breakpoint swaps the layout live; state (open terminals, filters, focused terminal via `#focus=`) is preserved.
