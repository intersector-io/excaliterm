import { useCallback } from "react";
import { RotateCw, Copy, Lock, LockOpen, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useTerminalCollaboration } from "@/hooks/use-terminal-collaboration";
import { useCommandHistoryQueries } from "@/hooks/use-command-history";
import { useTerminals } from "@/hooks/use-terminal";
import { getStatusBadgeClasses, getStatusLabel } from "@/lib/terminal-status";
import { copyToClipboard } from "@/lib/clipboard";
import { TagEditor } from "@/components/canvas/TagEditor";
import type { TerminalStatus } from "@excaliterm/shared-types";

interface TerminalInfoFaceProps {
  terminalId: string;
  status: TerminalStatus;
  tags?: string[];
  onFlipBack: () => void;
  onRunCommand?: (command: string) => void;
  onClose?: () => void;
}

export function TerminalInfoFace({
  terminalId,
  status,
  tags,
  onFlipBack,
  onRunCommand,
  onClose,
}: Readonly<TerminalInfoFaceProps>) {
  const { commands } = useCommandHistoryQueries(terminalId);
  const { updateTerminal, deleteTerminal } = useTerminals();
  const {
    lockInfo,
    lockedByCurrentCollaborator,
    lockedByOther,
    lockTerminal,
    unlockTerminal,
  } = useTerminalCollaboration(terminalId);

  const recentCommands = commands.slice(0, 10);
  const isActive = status === "active";

  const handleCopyId = useCallback(() => {
    copyToClipboard(terminalId).then(() => toast.success("Copied")).catch(() => {});
  }, [terminalId]);

  const handleToggleLock = useCallback(async () => {
    try {
      if (lockedByCurrentCollaborator) {
        await unlockTerminal(terminalId);
      } else if (!lockInfo) {
        await lockTerminal(terminalId);
      }
    } catch {
      toast.error("Failed to change lock");
    }
  }, [terminalId, lockInfo, lockedByCurrentCollaborator, lockTerminal, unlockTerminal]);

  const handleClose = useCallback(async () => {
    try {
      if (isActive) await deleteTerminal(terminalId);
      onClose?.();
    } catch {
      toast.error("Failed to close terminal");
    }
  }, [terminalId, isActive, deleteTerminal, onClose]);

  const handleTagsChange = useCallback(
    (newTags: string[]) => {
      updateTerminal({ id: terminalId, data: { tags: newTags } }).catch(() => {});
    },
    [terminalId, updateTerminal],
  );

  return (
    <div className="flex h-full flex-col bg-card">
      {/* Header */}
      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-border px-3">
        <button
          onClick={onFlipBack}
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-accent-cyan transition-colors active:bg-surface-raised"
        >
          <RotateCw className="h-5 w-5" />
        </button>
        <span className="text-body-sm font-medium text-foreground">Terminal Info</span>
        <span
          className={`ml-auto rounded-full px-2 py-0.5 text-caption font-semibold uppercase tracking-wider ${getStatusBadgeClasses(status)}`}
        >
          {status}
        </span>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {/* Identity section */}
        <div className="border-b border-border-subtle px-4 py-3 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-caption font-medium uppercase tracking-wider text-muted-foreground/50">
              Terminal ID
            </span>
            <button onClick={handleCopyId} className="text-muted-foreground/40 active:text-foreground">
              <Copy className="h-3 w-3" />
            </button>
          </div>
          <span className="block font-mono text-body-sm text-foreground">{terminalId}</span>
          <span className="block text-caption text-muted-foreground/50">
            Status: {getStatusLabel(status)}
          </span>
        </div>

        {/* Tags section */}
        <div className="border-b border-border-subtle px-4 py-3">
          <span className="mb-2 block text-caption font-medium uppercase tracking-wider text-muted-foreground/50">
            Tags
          </span>
          <TagEditor tags={tags ?? []} onTagsChange={handleTagsChange} />
        </div>

        {/* Command history */}
        {recentCommands.length > 0 && (
          <div className="border-b border-border-subtle px-4 py-3">
            <span className="mb-2 block text-caption font-medium uppercase tracking-wider text-muted-foreground/50">
              Recent Commands
            </span>
            <div className="space-y-1">
              {recentCommands.map((cmd, i) => (
                <button
                  key={`${cmd.command}-${i}`}
                  onClick={() => {
                    onRunCommand?.(cmd.command);
                    onFlipBack();
                  }}
                  className="flex w-full items-center gap-2 rounded-md bg-surface-sunken/50 px-3 py-2 text-left font-mono text-caption text-foreground/80 transition-colors active:bg-surface-sunken active:text-foreground"
                >
                  <span className="text-muted-foreground/30">$</span>
                  <span className="truncate">{cmd.command}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Quick actions */}
        <div className="border-b border-border-subtle px-4 py-3">
          <span className="mb-2 block text-caption font-medium uppercase tracking-wider text-muted-foreground/50">
            Actions
          </span>
          <div className="grid grid-cols-2 gap-2">
            {isActive && (
              <button
                onClick={handleToggleLock}
                disabled={lockedByOther}
                className="flex items-center gap-2 rounded-lg border border-border-subtle bg-surface-raised/50 px-3 py-2.5 text-caption font-medium text-foreground transition-colors active:bg-surface-raised disabled:opacity-30"
              >
                {lockedByCurrentCollaborator ? (
                  <LockOpen className="h-3.5 w-3.5 text-accent-cyan" />
                ) : (
                  <Lock className="h-3.5 w-3.5" />
                )}
                {lockedByCurrentCollaborator ? "Unlock" : "Lock"}
              </button>
            )}
            <button
              onClick={handleClose}
              className="flex items-center gap-2 rounded-lg border border-accent-red/20 bg-accent-red/5 px-3 py-2.5 text-caption font-medium text-accent-red transition-colors active:bg-accent-red/15"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {isActive ? "Close" : "Dismiss"}
            </button>
          </div>
        </div>
      </div>

      {/* Connect button at bottom */}
      <div className="shrink-0 border-t border-border p-3">
        <button
          onClick={onFlipBack}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-accent-cyan text-background font-medium transition-all active:scale-[0.98]"
        >
          <RotateCw className="h-4 w-4" />
          Back to Terminal
        </button>
      </div>
    </div>
  );
}
