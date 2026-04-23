# Split Terminal View — Technical

Implemented entirely on the frontend in `apps/frontend/src/components/terminal/SplitTerminalView.tsx`. No REST or SignalR endpoints are involved — each pane mounts its own `TerminalView` component bound to a `terminalId`.

## Layout modes

Represented by a string enum: `single` | `h-split` | `v-split` | `quad`. CSS grid templates are applied per mode.

## Per-pane selection

Each pane stores the selected terminal ID in local state. `ServiceSelector`-style dropdowns (plain terminal picker) let the user swap terminals.

## Multiplexing

Each `<TerminalView>` instance maintains its own xterm.js viewport but shares the workspace-wide SignalR connection. Output streams are delivered via the global `TerminalOutput` broadcast and rendered into whichever panes are viewing that terminal.

## Key files

- `apps/frontend/src/components/terminal/SplitTerminalView.tsx`
- `apps/frontend/src/components/terminal/TerminalFullScreen.tsx` (wires the layout selector)
