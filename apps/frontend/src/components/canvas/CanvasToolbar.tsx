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
      <div className="flex h-12 items-center justify-between border-b border-border/60 bg-card/80 px-3 backdrop-blur-md">
        <div className="min-w-0">
          <h1 className="text-sm font-semibold tracking-tight text-foreground">
            Canvas
          </h1>
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
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
              className="flex h-7 items-center gap-1 rounded-full border border-border/50 bg-surface-raised/50 px-2 text-[10px] text-muted-foreground transition-colors hover:text-foreground"
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
            className={`h-7 gap-1 rounded-full px-2.5 text-[11px] ${
              noHost
                ? "border border-border/50 bg-muted/40 text-muted-foreground opacity-60"
                : "border border-accent-cyan/25 bg-accent-cyan/14 text-accent-cyan"
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
    <div className="flex h-14 items-center justify-between border-b border-white/[0.05] bg-[linear-gradient(180deg,rgba(17,22,39,0.94),rgba(11,14,25,0.86))] px-4 backdrop-blur-md">
      <div className="flex min-w-0 items-center gap-3">
        <div className="min-w-0">
          <h1 className="text-sm font-semibold tracking-tight text-foreground">
            Terminal canvas
          </h1>
          <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground/85">
            <span className="truncate">{collaborator.displayName}</span>
            <span className="hidden font-mono tracking-[0.2em] text-muted-foreground/45 md:inline">
              {workspaceId.slice(0, 8)}
            </span>
          </div>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-surface-raised/70 px-2.5 py-1 text-[10px] text-muted-foreground">
          <Users className="h-3 w-3" />
          {collaboratorCount} here
        </span>
        <span
          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] ${
            noHost
              ? "border-accent-amber/20 bg-accent-amber/8 text-accent-amber"
              : "border-accent-green/20 bg-accent-green/8 text-accent-green"
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${noHost ? "bg-accent-amber animate-pulse" : "bg-accent-green"}`}
          />
          {noHost
            ? "No host connected"
            : `${onlineCount} host${onlineCount === 1 ? "" : "s"} ready`}
        </span>
        {terminalCount > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-surface-raised/70 px-2.5 py-1 text-[10px] text-muted-foreground">
            <Terminal className="h-3 w-3" />
            {terminalCount} terminal{terminalCount === 1 ? "" : "s"}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        {/* Terminal button with dropdown for actions */}
        <div className="flex items-center">
          <Button
            size="sm"
            variant="secondary"
            onClick={onNewTerminal}
            disabled={isCreating}
            title={noHost ? "Connect a host service first" : "Create a new terminal session"}
            className={`h-8 gap-1.5 rounded-full px-3.5 text-xs transition-all ${
              terminalCount > 0 ? "rounded-r-none border-r-0" : ""
            } ${
              noHost
                ? "border border-border/50 bg-muted/30 text-muted-foreground/50 cursor-not-allowed"
                : "border border-accent-cyan/25 bg-accent-cyan/14 text-accent-cyan shadow-[0_14px_36px_rgba(34,211,238,0.12)] hover:bg-accent-cyan/22"
            }`}
          >
            <Terminal className="h-3 w-3" />
            {isCreating ? "Creating..." : "Terminal"}
          </Button>
          {terminalCount > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-8 w-7 rounded-full rounded-l-none border border-l-0 border-accent-cyan/25 bg-accent-cyan/14 px-0 text-accent-cyan hover:bg-accent-cyan/22"
                >
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onNewTerminal} disabled={isCreating || noHost}>
                  <Plus className="h-3.5 w-3.5" />
                  <span>New Terminal</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={onCloseAll}
                  disabled={isClosingAll}
                  className="text-accent-red focus:text-accent-red"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>{isClosingAll ? "Closing..." : `Close all (${terminalCount})`}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        <Button
          size="sm"
          variant="secondary"
          onClick={onNewNote}
          disabled={isCreatingNote}
          className="h-8 gap-1.5 rounded-full border border-border/70 bg-secondary/80 px-3 text-xs"
        >
          <StickyNote className="h-3 w-3" />
          {isCreatingNote ? "Creating..." : "Note"}
        </Button>
        <button
          onClick={handleShare}
          className="flex h-8 items-center gap-1.5 rounded-full border border-border/60 bg-surface-raised/65 px-3 text-xs text-muted-foreground transition-all hover:border-accent-cyan/30 hover:text-foreground"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 text-accent-green" />
              <span className="text-accent-green">Copied</span>
            </>
          ) : (
            <>
              <Link2 className="h-3 w-3" />
              <span>Share</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
