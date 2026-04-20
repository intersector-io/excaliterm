import { createPortal } from "react-dom";
import { ArrowLeft, Lock, LockOpen } from "lucide-react";
import { useTerminalCollaboration } from "@/hooks/use-terminal-collaboration";
import type { TerminalStatus } from "@terminal-proxy/shared-types";
import { TerminalView } from "./TerminalView";

interface TerminalFullScreenProps {
  terminalId: string;
  status: TerminalStatus;
  onBack: () => void;
}

export function TerminalFullScreen({ terminalId, status, onBack }: TerminalFullScreenProps) {
  const {
    lockInfo,
    lockedByCurrentCollaborator,
    lockedByOther,
    lockTerminal,
    unlockTerminal,
  } = useTerminalCollaboration(terminalId);

  return createPortal(
    <div className="fixed inset-0 z-[100] flex flex-col bg-background">
      {/* Header */}
      <div className="flex h-11 shrink-0 items-center gap-3 border-b border-border bg-card px-3">
        <button
          onClick={onBack}
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <span className="truncate font-mono text-xs text-muted-foreground/60">
          {terminalId.slice(0, 8)}
        </span>
        {lockInfo && (
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
            lockedByCurrentCollaborator
              ? "bg-accent-cyan/15 text-accent-cyan"
              : "bg-accent-amber/15 text-accent-amber"
          }`}>
            {lockedByCurrentCollaborator ? "Locked by you" : `Locked by ${lockInfo.displayName}`}
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
    </div>,
    document.body,
  );
}
