import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, Lock, LockOpen, ChevronLeft, ChevronRight, ChevronsUp, ChevronsDown, RotateCw, Columns2 } from "lucide-react";
import { useTerminalCollaboration } from "@/hooks/use-terminal-collaboration";
import { useMediaQuery } from "@/hooks/use-media-query";
import { getStatusBadgeClasses } from "@/lib/terminal-status";
import type { TerminalStatus } from "@excaliterm/shared-types";
import { TerminalView } from "./TerminalView";
import { VirtualKeyboardBar } from "./VirtualKeyboardBar";
import { TerminalInfoFace } from "./TerminalInfoFace";
import { SplitTerminalView } from "./SplitTerminalView";
import { getTagColor } from "@/components/canvas/TagEditor";
import { useVisualViewportHeight } from "@/hooks/use-visual-viewport";

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

  const isMobile = useMediaQuery("(max-width: 767px)");
  const viewportHeight = useVisualViewportHeight();
  const hasCycling = onPrev && onNext && totalCount && totalCount > 1;
  const [flipped, setFlipped] = useState(false);
  const [hasFlipped, setHasFlipped] = useState(false);
  const [splitMode, setSplitMode] = useState(false);

  // Refs for virtual keyboard and scroll
  const inputRef = useRef<((data: string) => void) | null>(null);
  const scrollRef = useRef<{
    scrollUp: () => void;
    scrollDown: () => void;
    scrollToTop: () => void;
    scrollToBottom: () => void;
  } | null>(null);

  const handleKeyboardInput = useCallback((data: string) => {
    inputRef.current?.(data);
  }, []);

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
      className="fixed inset-x-0 top-0 z-[100] flex flex-col bg-background"
      style={{ height: isMobile ? `${viewportHeight}px` : "100%" }}
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
        {/* Split button (desktop only) */}
        {!isMobile && (
          <button
            onClick={() => setSplitMode((s) => !s)}
            className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors active:bg-surface-raised ${
              splitMode ? "text-accent-cyan" : "text-muted-foreground"
            }`}
            title="Split terminal view"
          >
            <Columns2 className="h-4 w-4" />
          </button>
        )}
        {/* Flip button (mobile only) */}
        {isMobile && (
          <button
            onClick={() => { setFlipped((f) => !f); setHasFlipped(true); }}
            className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors active:bg-surface-raised ${
              flipped ? "text-accent-cyan" : "text-muted-foreground"
            }`}
          >
            <RotateCw className="h-4 w-4" />
          </button>
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

      {/* Desktop split mode */}
      {splitMode && !isMobile ? (
        <div className="flex-1 overflow-hidden">
          <SplitTerminalView initialTerminalId={terminalId} />
        </div>
      ) : (
      /* Flippable content area */
      <div className="card-flip-container relative flex-1 overflow-hidden">
        {/* Front face: Terminal */}
        <div className={`card-face card-face-front absolute inset-0 flex flex-col ${flipped ? "flipped" : ""}`}>
          <div className="relative flex-1 overflow-hidden">
            <TerminalView
              terminalId={terminalId}
              status={status}
              compact
              inputRef={inputRef}
              scrollRef={scrollRef}
            />

            {/* Floating scroll buttons */}
            {isMobile && !flipped && (
              <div className="absolute right-3 bottom-4 flex flex-col gap-1 rounded-xl border border-border-subtle/30 bg-card/70 p-1 opacity-50 backdrop-blur-sm transition-opacity active:opacity-100">
                <button
                  onClick={() => scrollRef.current?.scrollUp()}
                  className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors active:bg-surface-raised active:text-foreground"
                >
                  <ChevronsUp className="h-4 w-4" />
                </button>
                <button
                  onClick={() => scrollRef.current?.scrollDown()}
                  className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors active:bg-surface-raised active:text-foreground"
                >
                  <ChevronsDown className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>

          {/* Virtual keyboard bar (mobile only) */}
          {isMobile && status === "active" && !flipped && (
            <VirtualKeyboardBar onInput={handleKeyboardInput} />
          )}
        </div>

        {/* Back face: Info panel (lazy-mounted on first flip) */}
        <div className={`card-face card-face-back absolute inset-0 ${flipped ? "flipped" : ""}`}>
          {hasFlipped && <TerminalInfoFace
            terminalId={terminalId}
            status={status}
            tags={tags}
            onFlipBack={() => setFlipped(false)}
            onRunCommand={(cmd) => inputRef.current?.(cmd + "\r")}
            onClose={onBack}
          />}
        </div>
      </div>
      )}

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
