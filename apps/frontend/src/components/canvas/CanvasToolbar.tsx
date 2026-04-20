import { useState, useCallback } from "react";
import { useTerminals } from "@/hooks/use-terminal";
import { useNotes } from "@/hooks/use-notes";
import { useWorkspace } from "@/hooks/use-workspace";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useServices } from "@/hooks/use-services";
import { useTerminalCollaboration } from "@/hooks/use-terminal-collaboration";
import { Button } from "@/components/ui/button";
import { Link2, Check, Terminal, StickyNote, Server, Users } from "lucide-react";

export function CanvasToolbar() {
  const { createTerminal, isCreating } = useTerminals();
  const { createNote, isCreating: isCreatingNote } = useNotes();
  const { workspaceId, collaborator } = useWorkspace();
  const { onlineCount } = useServices();
  const { collaboratorCount } = useTerminalCollaboration();
  const isMobile = useMediaQuery("(max-width: 767px)");
  const [copied, setCopied] = useState(false);

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
    try {
      await createTerminal({});
    } catch (err) {
      console.error("Failed to create terminal:", err);
    }
  }

  async function onNewNote() {
    try {
      await createNote({});
    } catch (err) {
      console.error("Failed to create note:", err);
    }
  }

  if (isMobile) {
    return (
      <div className="flex h-11 items-center justify-between border-b border-border/60 bg-card/80 backdrop-blur-md px-3">
        <div className="min-w-0">
          <h1 className="text-sm font-semibold text-foreground tracking-tight">
            Canvas
          </h1>
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <span className="truncate">{collaborator.displayName}</span>
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {collaboratorCount}
            </span>
            <span className="flex items-center gap-1">
              <Server className="h-3 w-3" />
              {onlineCount}
            </span>
          </div>
        </div>
        <button
          onClick={handleShare}
          className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground transition-colors"
          title="Share workspace"
        >
          {copied ? (
            <Check className="h-4 w-4 text-accent-green" />
          ) : (
            <Link2 className="h-4 w-4" />
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-12 items-center justify-between border-b border-border/60 bg-card/80 backdrop-blur-md px-4">
      <div className="flex items-center gap-3">
        <h1 className="text-sm font-semibold text-foreground tracking-tight">
          Terminal Proxy
        </h1>
        <div className="h-4 w-px bg-border/60" />
        <span className="font-mono text-[10px] text-muted-foreground/60 tracking-wider">
          {workspaceId.slice(0, 8)}
        </span>
        <div className="h-4 w-px bg-border/60" />
        <span className="text-[11px] text-muted-foreground">
          {collaborator.displayName}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-surface-raised/50 px-2 py-1 text-[10px] text-muted-foreground">
          <Users className="h-3 w-3" />
          {collaboratorCount} here
        </span>
        <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-surface-raised/50 px-2 py-1 text-[10px] text-muted-foreground">
          <Server className={`h-3 w-3 ${onlineCount > 0 ? "text-accent-green" : "text-accent-amber"}`} />
          {onlineCount > 0 ? `${onlineCount} host${onlineCount === 1 ? "" : "s"} ready` : "No host"}
        </span>
        <div className="h-4 w-px bg-border/60" />
        <Button
          size="sm"
          variant="secondary"
          onClick={onNewTerminal}
          disabled={isCreating}
          className="gap-1.5 h-7 text-xs"
        >
          <Terminal className="h-3 w-3" />
          {isCreating ? "Creating..." : "Terminal"}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={onNewNote}
          disabled={isCreatingNote}
          className="gap-1.5 h-7 text-xs"
        >
          <StickyNote className="h-3 w-3" />
          {isCreatingNote ? "Creating..." : "Note"}
        </Button>
      </div>

      <button
        onClick={handleShare}
        className="flex h-7 items-center gap-1.5 rounded-md border border-border/60 bg-surface-raised/50 px-3 text-xs text-muted-foreground hover:text-foreground hover:border-accent-cyan/30 transition-all"
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
  );
}
