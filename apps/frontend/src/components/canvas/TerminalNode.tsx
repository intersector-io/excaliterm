import { memo, useCallback, useState } from "react";
import { type NodeProps, type Node, NodeResizer, Handle, Position } from "@xyflow/react";
import { Lock, LockOpen, MoreHorizontal, Trash2, Copy, Camera, Monitor, AlertTriangle, History, Maximize2 } from "lucide-react";
import { toast } from "sonner";
import { TerminalView } from "@/components/terminal/TerminalView";
import { useTerminalCollaboration } from "@/hooks/use-terminal-collaboration";
import { useTerminals } from "@/hooks/use-terminal";
import { useCanvas, type TerminalNodeData } from "@/hooks/use-canvas";
import { useScreenshot } from "@/hooks/use-screenshot";
import { useScreenShare } from "@/hooks/use-screen-share";
import { useCommandHistorySave } from "@/hooks/use-command-history";
import { copyToClipboard } from "@/lib/clipboard";
import { useFullscreenStore } from "@/stores/fullscreen-store";
import { useMediaQuery } from "@/hooks/use-media-query";
import { getStatusDotColor, getStatusLabel, isStaleStatus } from "@/lib/terminal-status";
import { TagEditor } from "./TagEditor";
import { MonitorPickerDialog, type MonitorPickerMode } from "./MonitorPickerDialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

type TerminalNodeType = Node<TerminalNodeData>;

function TerminalNodeComponent({ id, data, selected }: NodeProps<TerminalNodeType>) {
  const { deleteTerminal, updateTerminal } = useTerminals();
  const { nodes: canvasNodes, deleteNode, addScreenShareNode } = useCanvas();
  const { monitors, isLoadingMonitors, isCapturing, listMonitors, captureScreenshot } = useScreenshot();
  const { startScreenShare } = useScreenShare();
  const { saveCommand, createNode: createHistoryNode } = useCommandHistorySave(data.terminalId);
  const openFullScreen = useFullscreenStore((s) => s.open);
  const isMobile = useMediaQuery("(max-width: 767px)");
  const [hovered, setHovered] = useState(false);
  const [monitorPickerOpen, setMonitorPickerOpen] = useState(false);
  const [monitorPickerMode, setMonitorPickerMode] = useState<MonitorPickerMode>("screenshot");
  const {
    lockInfo,
    activeTypers,
    lockedByCurrentCollaborator,
    lockedByOther,
    lockTerminal,
    unlockTerminal,
  } = useTerminalCollaboration(data.terminalId);

  const isActive = data.status === "active";
  const isStale = isStaleStatus(data.status);
  const hasHistoryNode = canvasNodes.some(
    (n) => n.type === "command-history" && (n.data as { terminalSessionId?: string }).terminalSessionId === data.terminalId,
  );

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

  const handleCopyId = useCallback(() => {
    copyToClipboard(data.terminalId).then(() => {
      toast.success("Terminal ID copied");
    }).catch(() => {});
  }, [data.terminalId]);

  const handleOpenMonitorPicker = useCallback((mode: MonitorPickerMode) => {
    if (!data.serviceId) {
      toast.error("No host service associated with this terminal");
      return;
    }
    setMonitorPickerMode(mode);
    setMonitorPickerOpen(true);
    listMonitors(data.serviceId).catch(() => {
      toast.error("Failed to list monitors");
    });
  }, [data.serviceId, listMonitors]);

  const handleScreenshot = useCallback(
    async (monitorIndex: number) => {
      if (!data.serviceId || !data.serviceInstanceId) return;
      try {
        await captureScreenshot(data.serviceId, data.serviceInstanceId, monitorIndex, id);
        setMonitorPickerOpen(false);
        toast.success("Screenshot captured");
      } catch {
        toast.error("Failed to capture screenshot");
      }
    },
    [data.serviceId, data.serviceInstanceId, id, captureScreenshot],
  );

  const handleStream = useCallback(
    async (monitorIndex: number) => {
      if (!data.serviceId) return;
      try {
        setMonitorPickerOpen(false);
        toast.info("Starting screen share...");
        const monitorInfo = monitors[monitorIndex];
        const session = await startScreenShare(data.serviceId, monitorIndex);
        addScreenShareNode(
          session.sessionId,
          data.serviceId,
          monitorIndex,
          monitorInfo?.name ?? `Monitor ${monitorIndex + 1}`,
          monitorInfo?.width ?? 1920,
          monitorInfo?.height ?? 1080,
          id, // source terminal node ID
        );
        toast.success("Screen share started");
      } catch {
        toast.error("Failed to start screen share");
      }
    },
    [data.serviceId, id, monitors, startScreenShare, addScreenShareNode],
  );

  const handleCommandDetected = useCallback(
    (_terminalId: string, command: string) => {
      saveCommand(command);
    },
    [saveCommand],
  );

  const handleToggleHistory = useCallback(async () => {
    try {
      const existing = canvasNodes.find(
        (n) => n.type === "command-history" && (n.data as { terminalSessionId?: string }).terminalSessionId === data.terminalId,
      );
      if (existing) {
        await deleteNode(existing.id);
      } else {
        await createHistoryNode({ sourceTerminalNodeId: id });
      }
    } catch {
      toast.error("Failed to toggle command history");
    }
  }, [canvasNodes, data.terminalId, id, createHistoryNode, deleteNode]);

  const handleFocus = useCallback(() => {
    openFullScreen({
      terminalId: data.terminalId,
      status: data.status,
      tags: data.tags,
    });
  }, [data.terminalId, data.status, data.tags, openFullScreen]);

  const statusColor = getStatusDotColor(data.status);
  const statusLabel = getStatusLabel(data.status);

  const firstActiveTyper = activeTypers[0] ?? null;

  function getGlowClass(): string {
    if (activeTypers.length > 0) return "terminal-glow-typing border-accent-cyan/20";
    if (lockedByOther) return "terminal-glow-locked border-accent-amber/15";
    return "shadow-[0_12px_40px_rgba(0,0,0,0.35)]";
  }

  const glowClass = getGlowClass();
  const borderClass = isActive ? "border-border-default/60 bg-card" : "border-border-subtle/40 bg-card/80";

  return (
    <div
      className="h-full w-full"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <NodeResizer
        minWidth={isMobile ? 340 : 520}
        minHeight={isMobile ? 240 : 340}
        isVisible={(!!selected || hovered) && !lockedByOther}
        lineClassName="!border-white/20"
        handleClassName="!w-2 !h-2 !bg-white/60 !border-0 !rounded-sm"
      />
      <Handle
        type="target"
        position={Position.Top}
        className="!w-1.5 !h-1.5 !bg-white/40 !border-0 !rounded-sm"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-1.5 !h-1.5 !bg-white/40 !border-0 !rounded-sm"
      />
      <div
        className={`flex h-full w-full flex-col overflow-hidden rounded-xl border transition-all duration-300 ${borderClass} ${glowClass}`}
      >
        {/* ─── Title Bar ─────────────────────────────────────────────── */}
        <div className="drag-handle flex items-center justify-between border-b border-border-subtle px-3.5 min-h-[40px] py-1.5">
          <div className="flex min-w-0 items-center gap-2.5">
            {/* Status dot */}
            <div
              className={`h-2 w-2 shrink-0 rounded-full ${statusColor}`}
            />
            {/* Terminal ID + status */}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="truncate font-mono text-body-sm font-semibold text-white/90">
                  {data.terminalId.slice(0, 8)}
                </span>
                <span className="text-caption text-white/40">{statusLabel}</span>
                {data.exitCode !== null && (
                  <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-1.5 py-0 text-caption text-white/40">
                    exit {data.exitCode}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 pl-2">
            {/* Typing indicator — always visible when active */}
            {firstActiveTyper && (
              <span className="hidden max-w-32 truncate rounded-full border border-accent-cyan/15 bg-accent-cyan/10 px-2 py-0.5 text-caption font-medium text-accent-cyan/85 lg:inline-flex">
                {firstActiveTyper.displayName}
                {activeTypers.length > 1 ? ` +${activeTypers.length - 1}` : ""} typing
              </span>
            )}

            {/* Lock indicator — shown when locked */}
            {lockInfo && (
              <span
                className={`rounded-full border px-2 py-0.5 text-caption font-semibold ${
                  lockedByCurrentCollaborator
                    ? "border-accent-cyan/20 bg-accent-cyan/15 text-accent-cyan"
                    : "border-accent-amber/20 bg-accent-amber/15 text-accent-amber"
                }`}
              >
                {lockedByCurrentCollaborator
                  ? "Locked by you"
                  : `Locked: ${lockInfo.displayName}`}
              </span>
            )}

            {/* Lock button — hover/select only */}
            {isActive && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggleLock().catch(() => {});
                }}
                disabled={lockedByOther}
                className={(() => {
                  const base = "nodrag nopan flex items-center gap-1 rounded-full border px-2 py-1 text-caption font-semibold transition-colors";
                  if (lockedByCurrentCollaborator) return `${base} border-accent-cyan/25 bg-accent-cyan/15 text-accent-cyan hover:bg-accent-cyan/25`;
                  if (lockedByOther) return `${base} border-white/[0.05] bg-white/[0.03] text-white/25`;
                  return `${base} border-white/[0.08] bg-white/[0.05] text-white/60 hover:bg-white/[0.1] hover:text-white/90`;
                })()}
              >
                {lockedByCurrentCollaborator ? (
                  <LockOpen className="h-3 w-3" />
                ) : (
                  <Lock className="h-3 w-3" />
                )}
              </button>
            )}

            {/* Overflow menu — hover/select only */}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="nodrag nopan flex h-6 w-6 items-center justify-center rounded-md text-white/40 transition-colors hover:bg-white/[0.08] hover:text-white/70"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleFocus}>
                    <Maximize2 className="h-3.5 w-3.5" />
                    <span>Focus</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleCopyId}>
                    <Copy className="h-3.5 w-3.5" />
                    <span>Copy terminal ID</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleToggleHistory}>
                    <History className="h-3.5 w-3.5" />
                    <span>{hasHistoryNode ? "Hide Command History" : "Command History"}</span>
                  </DropdownMenuItem>
                  {isActive && data.serviceId && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => handleOpenMonitorPicker("screenshot")}>
                        <Camera className="h-3.5 w-3.5" />
                        <span>Screenshot</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleOpenMonitorPicker("stream")}>
                        <Monitor className="h-3.5 w-3.5" />
                        <span>Screen Share</span>
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleClose}
                    className="text-accent-red focus:text-accent-red"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>{isActive ? "Close terminal" : "Dismiss"}</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
          </div>
        </div>

        {/* ─── Tags Row ────────────────────────────────────────────────── */}
        <div className="nodrag nopan flex items-center border-b border-border-subtle/50 px-3.5 py-1">
          <TagEditor
            tags={data.tags ?? []}
            onTagsChange={(tags) => {
              updateTerminal({
                id: data.terminalId,
                data: { tags },
              }).catch(() => {});
            }}
            compact
          />
        </div>

        {/* ─── Terminal Content ───────────────────────────────────────── */}
        <div
          className={`nodrag nopan nowheel relative flex-1 overflow-hidden p-2.5 ${
            isActive ? "" : "opacity-70"
          }`}
        >
          <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-border-subtle/50 bg-surface-sunken">
            <div className="pointer-events-none flex items-center justify-between border-b border-border-subtle/50 px-3 py-1">
              <span className="font-mono text-caption uppercase tracking-[0.18em] text-muted-foreground/40">
                {isActive ? "Attached shell" : "Session snapshot"}
              </span>
              <span className="text-caption text-muted-foreground/40">
                {isActive ? "Interactive" : statusLabel}
              </span>
            </div>
            <div className="min-h-0 flex-1">
              <TerminalView terminalId={data.terminalId} status={data.status} onCommandDetected={handleCommandDetected} />
            </div>
          </div>

          {/* Stale session overlay */}
          {isStale && (
            <div className="absolute inset-0 flex items-end justify-center p-2.5">
              <div className="pointer-events-none absolute inset-0 rounded-lg bg-background/60" />
              <div className="nodrag nopan relative flex w-full items-center gap-3 rounded-lg border border-border-subtle/60 bg-surface-raised/95 px-4 py-3 shadow-[0_-4px_20px_rgba(0,0,0,0.3)]">
                <AlertTriangle className="h-4 w-4 shrink-0 text-accent-amber" />
                <div className="min-w-0 flex-1">
                  <p className="text-body-sm font-medium text-foreground/90">
                    Session expired
                  </p>
                  <p className="text-caption text-muted-foreground">
                    {data.status === "disconnected" ? "Host went offline" : "Terminal no longer available"}
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleClose();
                  }}
                  className="shrink-0 rounded-md border border-border-default/50 bg-white/[0.06] px-3 py-1.5 text-caption font-medium text-foreground/80 transition-colors hover:bg-white/[0.1] hover:text-foreground"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <MonitorPickerDialog
        open={monitorPickerOpen}
        onOpenChange={setMonitorPickerOpen}
        mode={monitorPickerMode}
        monitors={monitors}
        isLoadingMonitors={isLoadingMonitors}
        onScreenshot={handleScreenshot}
        onStream={handleStream}
        isCapturing={isCapturing}
      />
    </div>
  );
}

export const TerminalNode = memo(TerminalNodeComponent);
