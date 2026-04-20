import { memo, useCallback } from "react";
import { type NodeProps, NodeResizer, Handle, Position } from "@xyflow/react";
import type { Node } from "@xyflow/react";
import { Lock, LockOpen } from "lucide-react";
import { TerminalView } from "@/components/terminal/TerminalView";
import { useTerminalCollaboration } from "@/hooks/use-terminal-collaboration";
import { useTerminals } from "@/hooks/use-terminal";
import { useCanvas, type TerminalNodeData } from "@/hooks/use-canvas";
import { useMediaQuery } from "@/hooks/use-media-query";

type TerminalNodeType = Node<TerminalNodeData>;

function TerminalNodeComponent({ id, data, selected }: NodeProps<TerminalNodeType>) {
  const { deleteTerminal } = useTerminals();
  const { deleteNode } = useCanvas();
  const isMobile = useMediaQuery("(max-width: 767px)");
  const {
    lockInfo,
    activeTypers,
    lockedByCurrentCollaborator,
    lockedByOther,
    lockTerminal,
    unlockTerminal,
  } = useTerminalCollaboration(data.terminalId);

  const isActive = data.status === "active";

  const handleClose = useCallback(async () => {
    try {
      if (isActive) {
        await deleteTerminal(data.terminalId);
      }
      await deleteNode(id);
    } catch (err) {
      console.error("Failed to close terminal:", err);
    }
  }, [data.terminalId, id, isActive, deleteTerminal, deleteNode]);

  const handleToggleLock = useCallback(async () => {
    try {
      if (lockedByCurrentCollaborator) {
        await unlockTerminal(data.terminalId);
        return;
      }

      if (!lockInfo) {
        await lockTerminal(data.terminalId);
      }
    } catch (err) {
      console.error("Failed to change terminal lock:", err);
    }
  }, [
    data.terminalId,
    lockInfo,
    lockTerminal,
    lockedByCurrentCollaborator,
    unlockTerminal,
  ]);

  const statusColor =
    data.status === "active"
      ? "bg-accent-green"
      : data.status === "error"
        ? "bg-accent-red"
        : "bg-accent-amber";
  const firstActiveTyper = activeTypers[0] ?? null;

  return (
    <>
      <NodeResizer
        minWidth={isMobile ? 300 : 400}
        minHeight={isMobile ? 200 : 250}
        isVisible={!!selected && !lockedByOther}
        lineClassName="!border-accent-cyan/40"
        handleClassName="!w-2.5 !h-2.5 !bg-accent-cyan !border-0 !rounded-full !shadow-[0_0_6px_rgba(0,200,200,0.3)]"
      />
      <Handle
        type="target"
        position={Position.Top}
        className="!w-2 !h-2 !bg-accent-cyan/60 !border-0 !rounded-full"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-2 !h-2 !bg-accent-cyan/60 !border-0 !rounded-full"
      />
      <div
        className={`flex h-full w-full flex-col overflow-hidden rounded-xl border shadow-[0_8px_32px_rgba(0,0,0,0.4)] ${
          isActive
            ? "border-white/[0.06] bg-[#12122a]"
            : "border-white/[0.03] bg-[#12122a]/80"
        }`}
      >
        {/* Title bar */}
        <div className={`flex items-center justify-between border-b border-white/[0.04] bg-white/[0.02] px-3 drag-handle ${
          isMobile ? "min-h-[44px]" : "h-8"
        }`}>
          <div className="flex items-center gap-2.5">
            <div className="flex gap-1.5">
              <button
                onClick={handleClose}
                className="h-3 w-3 rounded-full bg-[#ff5f57] hover:bg-[#ff5f57]/80 transition-colors active:scale-90"
                title={isActive ? "Close terminal" : "Dismiss"}
              />
              <div className={`h-3 w-3 rounded-full ${isActive ? "bg-[#febc2e]" : "bg-white/[0.06]"}`} />
              <div className={`h-3 w-3 rounded-full ${isActive ? "bg-[#28c840]" : "bg-white/[0.06]"}`} />
            </div>
            <span className="ml-1 text-[10px] text-white/20 font-mono tracking-wider">
              {data.terminalId.slice(0, 8)}
            </span>
            <div className={`h-1.5 w-1.5 rounded-full ${statusColor} ${isActive ? "animate-pulse" : ""}`} />
          </div>
          <div className="flex items-center gap-2">
            {firstActiveTyper && (
              <span className="max-w-32 truncate text-[9px] text-accent-cyan/80">
                {firstActiveTyper.displayName}
                {activeTypers.length > 1 ? ` +${activeTypers.length - 1}` : ""} typing
              </span>
            )}
            {lockInfo && (
              <span
                className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${
                  lockedByCurrentCollaborator
                    ? "bg-accent-cyan/15 text-accent-cyan"
                    : "bg-accent-amber/15 text-accent-amber"
                }`}
              >
                {lockedByCurrentCollaborator ? "Locked by you" : `Locked by ${lockInfo.displayName}`}
              </span>
            )}
            {isActive && (
              <button
                onClick={(event) => {
                  event.stopPropagation();
                  handleToggleLock().catch(() => {});
                }}
                disabled={lockedByOther}
                className={`flex items-center gap-1 rounded-md px-2 py-1 text-[9px] transition-colors ${
                  lockedByCurrentCollaborator
                    ? "bg-accent-cyan/15 text-accent-cyan hover:bg-accent-cyan/25"
                    : lockedByOther
                      ? "bg-white/[0.04] text-white/25"
                      : "bg-white/[0.04] text-white/60 hover:bg-white/[0.08] hover:text-white/85"
                }`}
                title={
                  lockedByCurrentCollaborator
                    ? "Release terminal lock"
                    : lockedByOther
                      ? `Locked by ${lockInfo?.displayName}`
                      : "Lock terminal for exclusive input"
                }
              >
                {lockedByCurrentCollaborator ? (
                  <LockOpen className="h-3 w-3" />
                ) : (
                  <Lock className="h-3 w-3" />
                )}
                <span>{lockedByCurrentCollaborator ? "Unlock" : "Lock"}</span>
              </button>
            )}
            {!isActive && (
              <span className="text-[9px] uppercase tracking-[0.15em] text-white/20 font-semibold">
                {data.status}
              </span>
            )}
          </div>
        </div>
        {/* Terminal content */}
        <div className={`nodrag nopan nowheel flex-1 overflow-hidden ${
          !isActive ? "opacity-60" : ""
        }`}>
          <TerminalView terminalId={data.terminalId} status={data.status} />
        </div>
      </div>
    </>
  );
}

export const TerminalNode = memo(TerminalNodeComponent);
