import { memo, useCallback, useRef, useState, useEffect } from "react";
import { type NodeProps, type Node, NodeResizer, Handle, Position } from "@xyflow/react";
import { Monitor, X, Play, Pause, Maximize2, Minimize2 } from "lucide-react";
import { useCanvas, type ScreenShareNodeData } from "@/hooks/use-canvas";
import { useScreenShare } from "@/hooks/use-screen-share";
import { useScreenShareStore } from "@/stores/screen-share-store";
import { useMediaQuery } from "@/hooks/use-media-query";

type ScreenShareNodeType = Node<ScreenShareNodeData>;

function ScreenShareNodeComponent({ data, selected }: NodeProps<ScreenShareNodeType>) {
  const { removeScreenShareNode } = useCanvas();
  const { stopScreenShare } = useScreenShare();
  const isMobile = useMediaQuery("(max-width: 767px)");
  const [paused, setPaused] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  // Read frame from Zustand store (shared across all components)
  const session = useScreenShareStore((s) => s.sessions.get(data.sessionId));
  const isStreaming = session?.status === "streaming" && !!session.currentFrame;

  const handleClose = useCallback(() => {
    stopScreenShare(data.serviceId, data.sessionId);
    removeScreenShareNode(data.sessionId);
  }, [data.serviceId, data.sessionId, stopScreenShare, removeScreenShareNode]);

  const handleTogglePause = useCallback(() => {
    setPaused((p) => !p);
  }, []);

  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    function handleChange() {
      setIsFullscreen(document.fullscreenElement === contentRef.current);
    }
    document.addEventListener("fullscreenchange", handleChange);
    return () => document.removeEventListener("fullscreenchange", handleChange);
  }, []);

  const handleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      contentRef.current?.requestFullscreen?.().catch(() => {});
    }
  }, []);

  function getStreamStatusColor(): string {
    if (isStreaming && paused) return "bg-accent-amber";
    if (isStreaming) return "bg-accent-green animate-pulse";
    if (session) return "bg-accent-amber animate-pulse";
    return "bg-accent-red";
  }

  function getStreamStatusLabel(): string {
    if (isStreaming && paused) return "Paused";
    if (isStreaming) return "Live";
    if (session) return "Buffering";
    return "Stopped";
  }

  const statusColor = getStreamStatusColor();
  const statusLabel = getStreamStatusLabel();

  const frame = paused ? null : session?.currentFrame;
  const noFrameLabel = paused ? "Paused" : (session ? "Waiting for frames..." : "No stream");

  return (
    <>
      <NodeResizer
        minWidth={isMobile ? 340 : 520}
        minHeight={isMobile ? 240 : 340}
        isVisible={!!selected}
        lineClassName="!border-accent-green/40"
        handleClassName="!w-2 !h-2 !bg-accent-green !border-0 !rounded-sm"
      />
      <Handle
        type="target"
        position={Position.Top}
        className="!w-1.5 !h-1.5 !bg-accent-green/60 !border-0 !rounded-full"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-1.5 !h-1.5 !bg-accent-green/60 !border-0 !rounded-full"
      />
      <div
        className={`flex h-full w-full flex-col overflow-hidden rounded-xl border transition-all duration-500 ${
          isStreaming
            ? "border-accent-green/15 bg-card"
            : "border-white/[0.04] bg-card/82"
        } shadow-[0_12px_40px_rgba(0,0,0,0.35)]`}
      >
        {/* Title bar */}
        <div className="drag-handle relative z-10 flex items-center justify-between border-b border-border-subtle px-3.5 min-h-[40px] py-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`h-2.5 w-2.5 shrink-0 rounded-full ${statusColor}`} />
            <Monitor className="h-3.5 w-3.5 shrink-0 text-accent-green/60" />
            <span className="truncate font-mono text-body-sm font-semibold text-white/90">
              {data.monitorName || `Monitor ${data.monitorIndex + 1}`}
            </span>
            <span className="text-caption text-white/40">{statusLabel}</span>
          </div>
          <div className="flex items-center gap-1.5">
            {isStreaming && (
              <button
                onClick={handleTogglePause}
                className="nodrag nopan p-1.5 rounded-md hover:bg-white/[0.08] transition-colors text-white/40 hover:text-white/70"
                title={paused ? "Resume" : "Pause"}
              >
                {paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
              </button>
            )}
            <button
              onClick={handleFullscreen}
              className="nodrag nopan p-1.5 rounded-md hover:bg-white/[0.08] transition-colors text-white/40 hover:text-white/70"
              title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            >
              {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            </button>
            <button
              onClick={handleClose}
              className="nodrag nopan p-1.5 rounded-md hover:bg-red-500/20 transition-colors text-white/40 hover:text-red-400"
              title="Stop and close"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Frame content */}
        <div ref={contentRef} className="nodrag nopan nowheel flex-1 overflow-hidden bg-black relative">
          {frame ? (
            <img
              src={`data:image/jpeg;base64,${frame.imageBase64}`}
              alt="Screen share"
              className="h-full w-full object-contain"
              draggable={false}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex flex-col items-center gap-2 text-center">
                <Monitor className="h-8 w-8 text-accent-green/20 animate-pulse" />
                <span className="text-body-sm text-white/30">
                  {noFrameLabel}
                </span>
              </div>
            </div>
          )}
          {isFullscreen && (
            <button
              onClick={handleFullscreen}
              className="absolute top-4 right-4 flex items-center gap-2 rounded-lg border border-white/10 bg-black/70 px-3 py-2 text-caption font-medium text-white/80 backdrop-blur-sm transition-colors hover:bg-black/90 hover:text-white"
            >
              <Minimize2 className="h-4 w-4" />
              Exit fullscreen
            </button>
          )}
        </div>

        {/* Resolution info */}
        <div className="border-t border-white/[0.03] px-4 py-1.5">
          <span className="font-mono text-caption text-white/25">
            {frame?.width || data.monitorWidth} x {frame?.height || data.monitorHeight}
          </span>
        </div>
      </div>
    </>
  );
}

export const ScreenShareNode = memo(ScreenShareNodeComponent);
