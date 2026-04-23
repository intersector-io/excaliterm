# Command Palette — Technical

Implemented by `components/command-palette/CommandPalette.tsx`.

## Trigger

Global keyboard listener on `Cmd/Ctrl+K` in `AppShell.tsx` toggles the palette state.

## Commands

The command list is assembled from:

- A static array of built-in commands (`New Terminal`, `New Note`, `Go to Canvas`, `Go to Chat`, `Auto Layout`, ...).
- A dynamic list of per-terminal entries derived from the current `useTerminals()` query, labeled by short ID and tags.

Each command has:

- `id`, `label`, `category`, `icon`
- `isDisabled(ctx)` — evaluated every render (e.g. "no online host" disables *New Terminal*)
- `run(ctx)` — invoked on Enter / click. Uses `useNavigate`, the terminal creation mutation, the notes mutation, or direct state setters depending on the command.

## Filtering

Plain substring match on `label` (case-insensitive). Disabled entries still show up, but selection wraps around them.

## Accessibility

- Focus is trapped inside the palette while open.
- `role="listbox"` on the list, `role="option"` on rows.
- Esc closes; click outside closes.

## Key files

- `apps/frontend/src/components/command-palette/CommandPalette.tsx`
- `apps/frontend/src/components/layout/AppShell.tsx` (global shortcut)
