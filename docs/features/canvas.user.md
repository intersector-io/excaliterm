# Infinite Canvas

The infinite canvas is the main desktop workspace. It holds **nodes** (hosts, terminals, editors, notes, screenshots, screen streams, command history panels) connected by **edges** showing relationships.

## Navigation

- **Pan** — drag empty space.
- **Zoom** — mouse wheel or trackpad pinch.
- **Select** — click a node, Shift/Cmd-click to multi-select.
- **Move** — drag a node to reposition; position is persisted.
- **Resize** — drag a node's corner handles; size is persisted.

Minimap and zoom controls are shown in the canvas corner.

## Node types

| Node | Source | Shows |
|---|---|---|
| Host | Created automatically when an agent comes online | Host status, new-terminal and editor buttons |
| Terminal | Click **Terminal** on a host | Live xterm.js session, tags, status, menu |
| Editor | Click **Editor** on a host | File tree + code editor |
| Note | Command palette / canvas control | Markdown sticky note |
| Screenshot | Terminal menu → Take Screenshot | Captured image |
| Screen share | Terminal menu → Stream Screen | Live video stream |
| Command history | Terminal menu → Command History | Recent and top-10 commands |

## Auto Layout

Click **Auto Layout** in the toolbar to arrange every node in a top-down hierarchy using dagre: hosts on top, their terminals/editors below, then notes and media. Pan/zoom is preserved.

## Canvas toolbar

The top toolbar shows:

- Online host count (green) and offline count (gray)
- Active terminal count
- Collaborator count with avatars
- **Connect a Host** button (opens the registration dialog)
- **Auto Layout** button

## Deep-linking focused terminals

Opening a terminal fullscreen sets the URL hash to `#focus=<terminalId>`. Refreshing the page restores the fullscreen view, and sharing the URL with that hash opens the same terminal focused for another collaborator.

## Mobile

The infinite canvas is desktop-only. On mobile (≤767px) it is replaced by the [mobile experience](./mobile-experience.user.md) list view.
