import { useState, useMemo } from "react";
import { toast } from "sonner";
import { Terminal, X, Trash2, Circle } from "lucide-react";
import { useTerminals } from "@/hooks/use-terminal";
import { useCanvas } from "@/hooks/use-canvas";
import { Button } from "@/components/ui/button";
import { useMediaQuery } from "@/hooks/use-media-query";
import { TagChips, getTagColor } from "./TagEditor";

interface TerminalListPanelProps {
  open: boolean;
  onClose: () => void;
  onFocusTerminal: (nodeId: string) => void;
  onFullScreenTerminal?: (terminalId: string, status: string) => void;
}

export function TerminalListPanel({
  open,
  onClose,
  onFocusTerminal,
  onFullScreenTerminal,
}: TerminalListPanelProps) {
  const { terminals, closeAllTerminals, isClosingAll } = useTerminals();
  const { nodes } = useCanvas();
  const isMobile = useMediaQuery("(max-width: 767px)");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  const activeTerminals = terminals.filter((t) => t.status === "active");

  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    for (const t of terminals) {
      for (const tag of t.tags ?? []) {
        tagSet.add(tag);
      }
    }
    return Array.from(tagSet).sort();
  }, [terminals]);

  const filteredTerminals = useMemo(() => {
    if (!selectedTag) return terminals;
    return terminals.filter((t) => (t.tags ?? []).includes(selectedTag));
  }, [terminals, selectedTag]);

  async function handleCloseAll() {
    try {
      const result = await closeAllTerminals();
      toast.success(
        `Closed ${result.closed} terminal${result.closed === 1 ? "" : "s"}`,
      );
      onClose();
    } catch {
      toast.error("Failed to close terminals");
    }
  }

  function handleTapTerminal(terminalId: string, status: string) {
    if (isMobile && onFullScreenTerminal) {
      onFullScreenTerminal(terminalId, status);
      onClose();
      return;
    }
    const node = nodes.find(
      (n) =>
        n.type === "terminal" &&
        (n.data as { terminalId: string }).terminalId === terminalId,
    );
    if (node) {
      onFocusTerminal(node.id);
    }
    onClose();
  }

  if (!open) return null;

  const statusColor = (status: string) => {
    switch (status) {
      case "active":
        return "text-accent-green";
      case "error":
        return "text-accent-red";
      case "disconnected":
        return "text-accent-amber";
      default:
        return "text-muted-foreground";
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case "active":
        return "Live";
      case "error":
        return "Error";
      case "disconnected":
        return "Offline";
      case "exited":
        return "Exited";
      default:
        return status;
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={`fixed z-50 flex flex-col border-border/60 bg-card/95 backdrop-blur-md ${
          isMobile
            ? "inset-x-0 bottom-14 max-h-[70vh] rounded-t-2xl border-t"
            : "bottom-0 right-0 top-14 w-80 border-l"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/40 px-4 py-3">
          <div className="flex items-center gap-2">
            <Terminal className="h-4 w-4 text-accent-cyan" />
            <span className="text-sm font-semibold text-foreground">
              Terminals
            </span>
            <span className="rounded-full bg-surface-raised px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              {filteredTerminals.length}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {activeTerminals.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCloseAll}
                disabled={isClosingAll}
                className="h-7 gap-1 px-2 text-[11px] text-accent-red hover:text-accent-red"
              >
                <Trash2 className="h-3 w-3" />
                {isClosingAll ? "Closing..." : "Close all"}
              </Button>
            )}
            <button
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Tag filter */}
        {allTags.length > 0 && (
          <div className="border-b border-border/30 px-4 py-2">
            <TagChips
              tags={allTags}
              selectedTag={selectedTag}
              onSelectTag={setSelectedTag}
            />
          </div>
        )}

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {filteredTerminals.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
              <Terminal className="h-8 w-8 opacity-30" />
              <p className="text-xs">
                {selectedTag ? `No terminals with tag "${selectedTag}"` : "No terminals"}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border/30">
              {filteredTerminals.map((terminal) => (
                <button
                  key={terminal.id}
                  onClick={() => handleTapTerminal(terminal.id, terminal.status)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.03] active:bg-white/[0.06]"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border/40 bg-surface-raised/50">
                    <Terminal className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-mono text-[11px] text-foreground">
                        {terminal.id.slice(0, 8)}
                      </span>
                      <Circle
                        className={`h-2 w-2 fill-current ${statusColor(terminal.status)}`}
                      />
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-[10px] text-muted-foreground">
                      <span className={statusColor(terminal.status)}>
                        {statusLabel(terminal.status)}
                      </span>
                      {terminal.exitCode !== null && (
                        <span>exit {terminal.exitCode}</span>
                      )}
                    </div>
                    {(terminal.tags ?? []).length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {terminal.tags.map((tag) => (
                          <span
                            key={tag}
                            className={`rounded-full border px-1.5 py-0 text-[8px] font-medium ${getTagColor(tag)}`}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
