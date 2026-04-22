import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import {
  Terminal,
  StickyNote,
  LayoutDashboard,
  Settings,
  Search,
  Link2,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { copyToClipboard } from "@/lib/clipboard";
import { useTerminals } from "@/hooks/use-terminal";
import { useNotes } from "@/hooks/use-notes";
import { useServices } from "@/hooks/use-services";
import type { ActiveView } from "@/components/layout/AppShell";

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onViewChange: (view: ActiveView) => void;
}

interface CommandItem {
  id: string;
  label: string;
  category: "Create" | "Navigate" | "Actions" | "Terminals";
  icon: typeof Terminal;
  keywords: string[];
  action: () => void | Promise<void>;
  disabled?: boolean;
}

export function CommandPalette({
  open,
  onClose,
  onViewChange,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const { terminals, createTerminal, isCreating } = useTerminals();
  const { createNote } = useNotes();
  const { onlineCount } = useServices();

  const noHost = onlineCount === 0;

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const staticCommands: CommandItem[] = useMemo(
    () => [
      {
        id: "create-terminal",
        label: "New Terminal",
        category: "Create",
        icon: Terminal,
        keywords: ["create", "terminal", "shell", "new"],
        disabled: noHost || isCreating,
        action: async () => {
          if (noHost) {
            toast.error("No host connected");
            return;
          }
          try {
            await createTerminal({});
            toast.success("Terminal created");
          } catch {
            toast.error("Failed to create terminal");
          }
        },
      },
      {
        id: "create-note",
        label: "New Note",
        category: "Create",
        icon: StickyNote,
        keywords: ["create", "note", "sticky", "new"],
        action: async () => {
          try {
            await createNote({});
          } catch {
            toast.error("Failed to create note");
          }
        },
      },
      {
        id: "nav-canvas",
        label: "Go to Canvas",
        category: "Navigate",
        icon: LayoutDashboard,
        keywords: ["canvas", "dashboard", "home", "terminals"],
        action: () => onViewChange("canvas"),
      },
      {
        id: "nav-settings",
        label: "Go to Settings",
        category: "Navigate",
        icon: Settings,
        keywords: ["settings", "config", "preferences"],
        action: () => onViewChange("settings"),
      },
      {
        id: "copy-link",
        label: "Copy Workspace Link",
        category: "Actions",
        icon: Link2,
        keywords: ["share", "copy", "link", "workspace", "url"],
        action: async () => {
          await copyToClipboard(window.location.href);
          toast.success("Workspace link copied");
        },
      },
    ],
    [noHost, isCreating, createTerminal, createNote, onViewChange],
  );

  // Dynamic terminal search results
  const terminalCommands: CommandItem[] = useMemo(() => {
    if (!query.trim()) return [];
    return terminals
      .filter((t) => {
        const searchText = `${t.id} ${(t.tags ?? []).join(" ")}`.toLowerCase();
        return query
          .toLowerCase()
          .split(/\s+/)
          .every((token) => searchText.includes(token));
      })
      .slice(0, 5)
      .map((t) => ({
        id: `terminal-${t.id}`,
        label: `Terminal ${t.id.slice(0, 8)}`,
        category: "Terminals" as const,
        icon: Terminal,
        keywords: [t.id, ...(t.tags ?? [])],
        action: () => {
          onViewChange("canvas");
          // Terminal focus would happen via canvas
        },
      }));
  }, [terminals, query, onViewChange]);

  const allCommands = useMemo(
    () => [...staticCommands, ...terminalCommands],
    [staticCommands, terminalCommands],
  );

  const filteredCommands = useMemo(() => {
    if (!query.trim()) return staticCommands;
    const tokens = query.toLowerCase().split(/\s+/);
    return allCommands.filter((cmd) => {
      const searchText =
        `${cmd.label} ${cmd.keywords.join(" ")} ${cmd.category}`.toLowerCase();
      return tokens.every((token) => searchText.includes(token));
    });
  }, [query, allCommands, staticCommands]);

  // Reset selection when filter changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredCommands.length]);

  const executeCommand = useCallback(
    (cmd: CommandItem) => {
      if (cmd.disabled) return;
      onClose();
      // Small delay so the palette closes before action executes
      setTimeout(() => {
        cmd.action();
      }, 50);
    },
    [onClose],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((i) =>
            i < filteredCommands.length - 1 ? i + 1 : 0,
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((i) =>
            i > 0 ? i - 1 : filteredCommands.length - 1,
          );
          break;
        case "Enter":
          e.preventDefault();
          if (filteredCommands[selectedIndex]) {
            executeCommand(filteredCommands[selectedIndex]);
          }
          break;
        case "Escape":
          e.preventDefault();
          onClose();
          break;
      }
    },
    [filteredCommands, selectedIndex, executeCommand, onClose],
  );

  // Scroll selected item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-index="${selectedIndex}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  if (!open) return null;

  // Group commands by category
  const grouped = new Map<string, CommandItem[]>();
  for (const cmd of filteredCommands) {
    const list = grouped.get(cmd.category) ?? [];
    list.push(cmd);
    grouped.set(cmd.category, list);
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Palette */}
      <div className="fixed inset-x-0 top-[15%] z-[201] mx-auto w-full max-w-lg px-4">
        <div className="overflow-hidden rounded-lg border border-border-default bg-card shadow-[0_16px_48px_rgba(0,0,0,0.5)]">
          {/* Search input */}
          <div className="flex items-center gap-3 border-b border-border-subtle px-4 py-3">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a command..."
              className="flex-1 bg-transparent text-body text-foreground placeholder:text-muted-foreground/50 outline-none"
            />
            <kbd className="hidden rounded-md border border-border-default bg-surface-sunken px-1.5 py-0.5 text-caption text-muted-foreground sm:inline-block">
              ESC
            </kbd>
          </div>

          {/* Results */}
          <div ref={listRef} className="max-h-[320px] overflow-y-auto py-1.5">
            {filteredCommands.length === 0 ? (
              <div className="flex items-center justify-center py-8 text-body-sm text-muted-foreground">
                No results found
              </div>
            ) : (
              Array.from(grouped.entries()).map(([category, commands]) => (
                <div key={category}>
                  <div className="px-4 pt-2 pb-1">
                    <span className="text-caption font-medium uppercase tracking-wider text-muted-foreground/50">
                      {category}
                    </span>
                  </div>
                  {commands.map((cmd) => {
                    const globalIndex = filteredCommands.indexOf(cmd);
                    const Icon = cmd.icon;
                    const isSelected = globalIndex === selectedIndex;

                    return (
                      <button
                        key={cmd.id}
                        data-index={globalIndex}
                        onClick={() => executeCommand(cmd)}
                        onMouseEnter={() => setSelectedIndex(globalIndex)}
                        disabled={cmd.disabled}
                        className={`flex w-full items-center gap-3 px-4 py-2 text-left transition-colors ${
                          isSelected
                            ? "bg-accent-blue/10 text-foreground"
                            : "text-foreground/80 hover:bg-white/[0.03]"
                        } ${cmd.disabled ? "opacity-40 cursor-not-allowed" : ""}`}
                      >
                        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="flex-1 text-body-sm">{cmd.label}</span>
                        {isSelected && (
                          <Zap className="h-3 w-3 text-accent-blue/60" />
                        )}
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>

          {/* Footer hint */}
          <div className="flex items-center gap-3 border-t border-border-subtle px-4 py-2">
            <span className="text-caption text-muted-foreground/50">
              <kbd className="rounded border border-border-default px-1 py-0.5 text-caption">
                ↑↓
              </kbd>{" "}
              navigate{" "}
              <kbd className="rounded border border-border-default px-1 py-0.5 text-caption">
                ↵
              </kbd>{" "}
              select
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
