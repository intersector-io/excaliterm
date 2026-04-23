import { useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, Lock, LockOpen, ChevronLeft, ChevronRight } from "lucide-react";
import { useTerminalCollaboration } from "@/hooks/use-terminal-collaboration";
import { getStatusBadgeClasses } from "@/lib/terminal-status";
import type { TerminalStatus } from "@excaliterm/shared-types";
import { TerminalView } from "./TerminalView";
import { getTagColor } from "@/components/canvas/TagEditor";

function getLockButtonStyle(lockedBySelf: boolean, lockedByOther: boolean): string {
  if (lockedBySelf) return "bg-accent-cyan/15 text-accent-cyan";
  if (lockedByOther) return "bg-secondary text-muted-foreground";
  return "bg-secondary text-foreground";
}

const SWIPE_THRESHOLD = 60;

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

  // Keyboard: Escape to close
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onBack();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onBack]);

  // Swipe gestures for cycling on mobile
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (!touch) return;
    touchStartX.current = touch.clientX;
    touchStartY.current = touch.clientY;
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!hasCycling) return;
      const touch = e.changedTouches[0];
      if (!touch) return;
      const dx = touch.clientX - touchStartX.current;
      const dy = touch.clientY - touchStartY.current;

      // Only trigger if horizontal swipe is dominant
      if (Math.abs(dx) > SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy) * 1.5) {
        if (dx > 0 && onPrev) onPrev();
        if (dx < 0 && onNext) onNext();
      }
    },
    [hasCycling, onPrev, onNext],
  );

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex flex-col bg-background"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
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
                className={`rounded-full border px-1.5 py-0 text-caption font-medium ${getTagColor(tag)}`}
              >
                {tag}
              </span>
            ))}
          </div>
        )}
        {lockInfo && (
          <span
            className={`rounded-full px-2 py-0.5 text-caption font-semibold ${
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
            className={`ml-auto flex h-8 items-center gap-1 rounded-md px-2 text-caption ${getLockButtonStyle(lockedByCurrentCollaborator, lockedByOther)}`}
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
          className={`rounded-full px-2 py-0.5 text-caption font-semibold uppercase tracking-wider ${getStatusBadgeClasses(status)}`}
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
        <div className="flex h-14 shrink-0 items-center justify-between border-t border-border bg-card px-4">
          <button
            onClick={onPrev}
            className="flex h-11 w-11 items-center justify-center rounded-lg bg-surface-raised text-muted-foreground transition-colors hover:text-foreground active:scale-[0.95] active:bg-surface-raised/80"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <span className="text-caption text-muted-foreground">
            {(currentIndex ?? 0) + 1} of {totalCount}
          </span>
          <button
            onClick={onNext}
            className="flex h-11 w-11 items-center justify-center rounded-lg bg-surface-raised text-muted-foreground transition-colors hover:text-foreground active:scale-[0.95] active:bg-surface-raised/80"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      )}
    </div>,
    document.body,
  );
}
