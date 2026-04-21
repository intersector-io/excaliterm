import { createPortal } from "react-dom";
import { ArrowLeft, Lock, LockOpen, ChevronLeft, ChevronRight } from "lucide-react";
import { useTerminalCollaboration } from "@/hooks/use-terminal-collaboration";
import type { TerminalStatus } from "@excaliterm/shared-types";
import { TerminalView } from "./TerminalView";
import { getTagColor } from "@/components/canvas/TagEditor";

interface TerminalFullScreenProps {
  terminalId: string;
  status: TerminalStatus;
  tags?: string[];
  onBack: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  currentIndex?: number;
  totalCount?: number;
}

export function TerminalFullScreen({
  terminalId,
  status,
  tags,
  onBack,
  onPrev,
  onNext,
  currentIndex,
  totalCount,
}: TerminalFullScreenProps) {
  const {
    lockInfo,
    lockedByCurrentCollaborator,
    lockedByOther,
    lockTerminal,
    unlockTerminal,
  } = useTerminalCollaboration(terminalId);

  const hasCycling = onPrev && onNext && totalCount && totalCount > 1;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex flex-col bg-background">
      {/* Header */}
      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-border bg-card px-3">
        <button
          onClick={onBack}
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <span className="truncate font-mono text-xs text-muted-foreground/60">
          {terminalId.slice(0, 8)}
        </span>
        {(tags ?? []).length > 0 && (
          <div className="flex items-center gap-1">
            {tags!.map((tag) => (
              <span
                key={tag}
                className={`rounded-full border px-1.5 py-0 text-[9px] font-medium ${getTagColor(tag)}`}
              >
                {tag}
              </span>
            ))}
          </div>
        )}
        {lockInfo && (
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
              lockedByCurrentCollaborator
                ? "bg-accent-cyan/15 text-accent-cyan"
                : "bg-accent-amber/15 text-accent-amber"
            }`}
          >
            {lockedByCurrentCollaborator
              ? "Locked by you"
              : `Locked by ${lockInfo.displayName}`}
          </span>
        )}
        {status === "active" && (
          <button
            onClick={() => {
              if (lockedByCurrentCollaborator) {
                unlockTerminal(terminalId).catch(() => {});
              } else if (!lockInfo) {
                lockTerminal(terminalId).catch(() => {});
              }
            }}
            disabled={lockedByOther}
            className={`ml-auto flex h-8 items-center gap-1 rounded-md px-2 text-[10px] ${
              lockedByCurrentCollaborator
                ? "bg-accent-cyan/15 text-accent-cyan"
                : lockedByOther
                  ? "bg-secondary text-muted-foreground"
                  : "bg-secondary text-foreground"
            }`}
          >
            {lockedByCurrentCollaborator ? (
              <LockOpen className="h-3.5 w-3.5" />
            ) : (
              <Lock className="h-3.5 w-3.5" />
            )}
            <span>{lockedByCurrentCollaborator ? "Unlock" : "Lock"}</span>
          </button>
        )}
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
            status === "active"
              ? "bg-accent-green/20 text-accent-green"
              : status === "error"
                ? "bg-accent-red/20 text-accent-red"
                : status === "exited"
                  ? "bg-muted text-muted-foreground"
                  : "bg-accent-amber/20 text-accent-amber"
          }`}
        >
          {status}
        </span>
      </div>

      {/* Terminal fills the rest of the viewport */}
      <div className="flex-1 overflow-hidden">
        <TerminalView terminalId={terminalId} status={status} />
      </div>

      {/* Cycle navigation bar */}
      {hasCycling && (
        <div className="flex h-12 shrink-0 items-center justify-between border-t border-border bg-card px-4">
          <button
            onClick={onPrev}
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-raised text-muted-foreground transition-colors hover:text-foreground active:bg-surface-raised/80"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <span className="text-xs text-muted-foreground">
            {(currentIndex ?? 0) + 1} of {totalCount}
          </span>
          <button
            onClick={onNext}
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-raised text-muted-foreground transition-colors hover:text-foreground active:bg-surface-raised/80"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      )}
    </div>,
    document.body,
  );
}
