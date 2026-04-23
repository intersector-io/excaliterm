# Terminals

A terminal is a live shell session running on a connected host, streamed into your browser via xterm.js. You can type, see output, copy/paste, and collaborate with other people in real time.

## Creating a terminal

- **Desktop**: click **Terminal** on any online host node. A new terminal appears on the canvas.
- **Mobile**: open the Hosts section, tap the cyan **Terminal** button on an online host.
- **Command palette** (`Cmd/Ctrl+K`): choose **New Terminal** and pick a host.

New terminals default to 96×28 and are placed on the canvas in a 3-column grid.

## Terminal views

| View | How | Available |
|---|---|---|
| Canvas node | Default, appears on canvas | Desktop |
| Fullscreen | Double-click dock skeleton, or fullscreen button in node menu, or from the terminal list | Desktop & mobile |
| Split view | Fullscreen → choose H/V/Quad | Desktop |

The fullscreen URL is deep-linkable via `#focus=<terminalId>`.

## Status indicators

Every terminal shows a status:

- **Active** — animated green dot
- **Disconnected** — gray dot (host went offline)
- **Exited** — gray dot with exit code
- **Error** — red dot
- **Stale** — warning icon appears when no output has been received for >5s in `active` state

## Tags

Terminals can be tagged for organization:

- Add a tag from the terminal's overflow menu or mobile info face. Type and press Enter.
- Tags have consistent hash-based colors (6-color palette).
- Tags show up as colored left borders on mobile terminal cards and as chips in the dock.
- Remove a tag by clicking the × on the tag chip.

## Overflow menu

Hover a canvas node (or open the ⋯ menu on mobile) to get:

- **Lock** / **Unlock** — claim exclusive write access (see [collaboration.user.md](./collaboration.user.md))
- **Duplicate** — open another terminal on the same host
- **Close** — terminate the terminal
- **Dismiss** — archive the terminal (removes it from the UI without killing it)
- **Copy ID** — copy the terminal's short ID to clipboard
- **Take Screenshot** / **Stream Screen** — see [media.user.md](./media.user.md)
- **Command History** — see [command-history.user.md](./command-history.user.md)
- **Fullscreen** — open the focused view

## Mobile controls

In mobile fullscreen the terminal is augmented with:

- **Virtual keyboard bar** — ESC, TAB, CTRL (toggle), `/`, Enter, arrows, mic
- **Scroll buttons** — floating chevron buttons for scrolling up/down
- **Flippable card** — tap the rotate icon to see terminal info (ID, status, tags, recent commands, lock, delete)
- **Swipe** — swipe left/right (≥60px) to cycle between terminals
- **Prev/Next buttons** — chevrons in the header also cycle terminals

See [mobile-experience.user.md](./mobile-experience.user.md) for details.

## Closing terminals

- **Close** from the menu ends the terminal on the host (`exited` status).
- **Dismiss** archives a terminal without killing it.
- **Close all** is available from the canvas toolbar/menu to exit every active terminal at once.
