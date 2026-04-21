import { useState, useCallback } from "react";
import { toast } from "sonner";
import { useTerminals } from "@/hooks/use-terminal";
import { useNotes } from "@/hooks/use-notes";
import { useWorkspace } from "@/hooks/use-workspace";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useServices } from "@/hooks/use-services";
import { useTerminalCollaboration } from "@/hooks/use-terminal-collaboration";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Link2,
  Check,
  Terminal,
  StickyNote,
  Server,
  Users,
  AlertCircle,
  Trash2,
  ChevronDown,
  Plus,
  List,
} from "lucide-react";

interface CanvasToolbarProps {
  onOpenTerminalList?: () => void;
}

export function CanvasToolbar({ onOpenTerminalList }: CanvasToolbarProps) {
  const { createTerminal, isCreating, terminals, closeAllTerminals, isClosingAll } = useTerminals();
  const { createNote, isCreating: isCreatingNote } = useNotes();
  const { workspaceId, collaborator } = useWorkspace();
  const { onlineCount } = useServices();
  const { collaboratorCount } = useTerminalCollaboration();
  const isMobile = useMediaQuery("(max-width: 767px)");
  const [copied, setCopied] = useState(false);

  const noHost = onlineCount === 0;
  const activeTerminals = terminals.filter((t) => t.status === "active");
  const terminalCount = activeTerminals.length;

  const handleShare = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  }, []);

  async function onNewTerminal() {
    if (noHost) {
      toast.error("No host available", {
        description:
          "Register and connect a service before creating terminals.",
        icon: <AlertCircle className="h-4 w-4" />,
      });
      return;
    }
    try {
      await createTerminal({});
      toast.success("Terminal created");
    } catch {
      toast.error("Failed to create terminal", {
        description: "The host service may have gone offline. Try again.",
      });
    }
  }

  async function onNewNote() {
    try {
      await createNote({});
    } catch {
      toast.error("Failed to create note");
    }
  }

  async function onCloseAll() {
    try {
      const result = await closeAllTerminals();
      toast.success(`Closed ${result.closed} terminal${result.closed === 1 ? "" : "s"}`);
    } catch {
      toast.error("Failed to close terminals");
    }
  }

  if (isMobile) {
    return (
      <div className="flex h-11 items-center justify-between border-b border-border-default/50 bg-background px-3">
        <div className="min-w-0">
          <h1 className="text-body-sm font-semibold text-foreground">
            Canvas
          </h1>
          <div className="flex items-center gap-2 text-caption text-muted-foreground">
            <span className="truncate">{collaborator.displayName}</span>
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {collaboratorCount}
            </span>
            <span
              className={`flex items-center gap-1 ${noHost ? "text-accent-amber" : "text-accent-green"}`}
            >
              <Server className="h-3 w-3" />
              {noHost ? "No host" : onlineCount}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {terminalCount > 0 && (
            <button
              onClick={onOpenTerminalList}
              className="flex h-7 items-center gap-1 rounded-md border border-border-default/50 bg-surface-raised px-2 text-caption text-muted-foreground transition-colors hover:text-foreground"
            >
              <List className="h-3 w-3" />
              {terminalCount}
            </button>
          )}
          <Button
            size="sm"
            variant="secondary"
            onClick={onNewTerminal}
            disabled={isCreating}
            className={`h-7 gap-1 rounded-md px-2.5 text-caption ${
              noHost
                ? "border border-border-default/50 bg-muted/40 text-muted-foreground opacity-60"
                : "border border-accent-cyan/20 bg-accent-cyan/10 text-accent-cyan"
            }`}
          >
            <Terminal className="h-3 w-3" />
            {isCreating ? "..." : "Terminal"}
          </Button>
          <button
            onClick={handleShare}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground"
            title="Share workspace"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-accent-green" />
            ) : (
              <Link2 className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-11 items-center justify-between border-b border-border-default/50 bg-background px-4">
      {/* Left: Breadcrumb + single status indicator */}
      <div className="flex min-w-0 items-center gap-2 text-body-sm">
        <span className="font-semibold text-foreground truncate">
          {collaborator.displayName}
        </span>
        <span className="text-muted-foreground/30">/</span>
        <span className="font-mono text-caption text-muted-foreground/60 hidden md:inline">
          {workspaceId.slice(0, 12)}
        </span>
        <span className="ml-1 inline-flex items-center gap-1.5 text-caption text-muted-foreground/60">
          <span
            className={`h-1.5 w-1.5 rounded-full ${noHost ? "bg-accent-amber" : "bg-accent-green"}`}
          />
          {noHost
            ? "No host"
            : `${collaboratorCount} here, ${terminalCount} terminal${terminalCount === 1 ? "" : "s"}`}
        </span>
      </div>

      {/* Right: Actions — compact */}
      <div className="flex items-center gap-1.5">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="sm"
              variant="secondary"
              className="h-7 gap-1.5 rounded-md border border-border-default/50 px-3 text-xs"
            >
              <Plus className="h-3 w-3" />
              Add
              <ChevronDown className="h-3 w-3 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onNewTerminal} disabled={isCreating || noHost}>
              <Terminal className="h-3.5 w-3.5" />
              <span>{noHost ? "No host connected" : isCreating ? "Creating..." : "New Terminal"}</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onNewNote} disabled={isCreatingNote}>
              <StickyNote className="h-3.5 w-3.5" />
              <span>{isCreatingNote ? "Creating..." : "New Note"}</span>
            </DropdownMenuItem>
            {terminalCount > 0 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={onCloseAll}
                  disabled={isClosingAll}
                  className="text-accent-red focus:text-accent-red"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>{isClosingAll ? "Closing..." : `Close all (${terminalCount})`}</span>
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
        <button
          onClick={handleShare}
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-white/[0.04] hover:text-foreground"
          title="Copy workspace link"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-accent-green" />
          ) : (
            <Link2 className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
    </div>
  );
}
