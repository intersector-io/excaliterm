# File Editor

The **Editor** lets you browse a connected host's filesystem and open, edit, and save files in a code editor — all from the browser.

## Opening the editor

- **Desktop canvas**: click **Editor** on any online host node. An editor node appears on the canvas. Expand it to fullscreen.
- **Mobile**: tap **Editor** on a host card. The editor opens as a fullscreen overlay.
- **Command palette**: **New Editor**.

## Layout

| Side | Contents |
|---|---|
| Left (desktop) | File tree with the current path at the top |
| Right (desktop) / Full (mobile) | Code editor pane |

On mobile you toggle between tree and editor with a single button.

## Browsing files

- Click a folder to expand/collapse.
- Click a file to open it in the editor.
- The current path is shown at the top.

## Switching hosts

A **service selector** dropdown at the top of the editor lets you pick which host's files to browse. Online hosts are listed first. Defaults to the first online host when the editor is first opened.

## Editing and saving

- Type in the editor pane to modify the file.
- A dirty indicator appears when there are unsaved changes.
- Click **Save** to persist changes back to the host.

## File access limits

The terminal agent can be configured with `WHITELISTED_PATHS` (a comma-separated list). Anything outside those paths will refuse to list, read, or write. Path traversal (`..`) and null bytes are rejected.
