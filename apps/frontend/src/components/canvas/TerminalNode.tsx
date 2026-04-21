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
  const statusLabel =
    data.status === "active"
      ? "Live terminal"
      : data.status === "disconnected"
        ? "Host offline"
        : data.status === "error"
          ? "Needs attention"
          : "Session exited";
  const statusBadgeClass =
    data.status === "active"
      ? "border-accent-green/25 bg-accent-green/10 text-accent-green"
      : data.status === "error"
        ? "border-accent-red/25 bg-accent-red/10 text-accent-red"
        : "border-accent-amber/25 bg-accent-amber/10 text-accent-amber";
  const firstActiveTyper = activeTypers[0] ?? null;

  return (
    <>
      <NodeResizer
        minWidth={isMobile ? 340 : 520}
        minHeight={isMobile ? 240 : 340}
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
        className={`flex h-full w-full flex-col overflow-hidden rounded-[24px] border shadow-[0_28px_80px_rgba(0,0,0,0.42)] transition-shadow duration-300 ${
          isActive
            ? "border-white/[0.08] bg-[#12122a]"
            : "border-white/[0.04] bg-[#12122a]/82"
        }`}
      >
        <div className={`drag-handle flex items-center justify-between border-b border-white/[0.05] bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.01))] px-4 ${
          isMobile ? "min-h-[58px] py-3" : "min-h-[62px] py-3"
        }`}>
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex gap-1.5 pt-1">
              <button
                onClick={handleClose}
                className="h-3 w-3 rounded-full bg-[#ff5f57] hover:bg-[#ff5f57]/80 transition-colors active:scale-90"
                title={isActive ? "Close terminal" : "Dismiss"}
              />
              <div className={`h-3 w-3 rounded-full ${isActive ? "bg-[#febc2e]" : "bg-white/[0.06]"}`} />
              <div className={`h-3 w-3 rounded-full ${isActive ? "bg-[#28c840]" : "bg-white/[0.06]"}`} />
            </div>
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-2">
                <span className="truncate text-[12px] font-semibold tracking-[0.02em] text-white/88">
                  {statusLabel}
                </span>
                <div className={`h-2 w-2 shrink-0 rounded-full ${statusColor} ${isActive ? "animate-pulse shadow-[0_0_14px_rgba(120,255,190,0.45)]" : ""}`} />
              </div>
              <div className="mt-1 flex min-w-0 items-center gap-2">
                <span className="truncate font-mono text-[10px] tracking-[0.22em] text-white/30 uppercase">
                  {data.terminalId.slice(0, 8)}
                </span>
                {data.exitCode !== null && (
                  <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 text-[10px] font-medium text-white/46">
                    exit {data.exitCode}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 pl-3">
            {firstActiveTyper && (
              <span className="hidden max-w-40 truncate rounded-full border border-accent-cyan/15 bg-accent-cyan/10 px-2.5 py-1 text-[10px] font-medium text-accent-cyan/85 lg:inline-flex">
                {firstActiveTyper.displayName}
                {activeTypers.length > 1 ? ` +${activeTypers.length - 1}` : ""} typing
              </span>
            )}
            <span
              className={`hidden rounded-full border px-2.5 py-1 text-[10px] font-semibold tracking-[0.16em] uppercase md:inline-flex ${statusBadgeClass}`}
            >
              {data.status}
            </span>
            {lockInfo && (
              <span
                className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${
                  lockedByCurrentCollaborator
                    ? "border-accent-cyan/20 bg-accent-cyan/15 text-accent-cyan"
                    : "border-accent-amber/20 bg-accent-amber/15 text-accent-amber"
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
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px] font-semibold transition-colors ${
                  lockedByCurrentCollaborator
                    ? "border-accent-cyan/25 bg-accent-cyan/15 text-accent-cyan hover:bg-accent-cyan/25"
                    : lockedByOther
                      ? "border-white/[0.05] bg-white/[0.03] text-white/25"
                      : "border-white/[0.08] bg-white/[0.05] text-white/72 hover:bg-white/[0.1] hover:text-white/90"
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
                <span>{lockedByCurrentCollaborator ? "Unlock" : "Lock input"}</span>
              </button>
            )}
            {!isActive && (
              <span className={`text-[10px] font-semibold uppercase tracking-[0.16em] md:hidden ${data.status === "error" ? "text-accent-red" : "text-white/38"}`}>
                {data.status}
              </span>
            )}
          </div>
        </div>
        <div className={`nodrag nopan nowheel flex-1 overflow-hidden bg-[radial-gradient(circle_at_top,rgba(75,140,255,0.08),transparent_52%)] p-3 ${
          !isActive ? "opacity-70" : ""
        }`}>
          <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[20px] border border-white/[0.05] bg-[#0c1020] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_20px_45px_rgba(0,0,0,0.26)]">
            <div className="pointer-events-none flex items-center justify-between border-b border-white/[0.05] px-4 py-2">
              <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-white/26">
                {isActive ? "Attached shell" : "Session snapshot"}
              </span>
              <span className="text-[10px] text-white/26">
                {isActive ? "Interactive" : statusLabel}
              </span>
            </div>
            <div className="min-h-0 flex-1">
              <TerminalView terminalId={data.terminalId} status={data.status} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export const TerminalNode = memo(TerminalNodeComponent);
