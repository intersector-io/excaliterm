import { memo, useCallback, useRef, useState, useEffect } from "react";
import { type NodeProps, type Node, NodeResizer, Handle, Position } from "@xyflow/react";
import { Camera, X, Clock, Maximize2, Minimize2 } from "lucide-react";
import { useCanvas } from "@/hooks/use-canvas";
import { useMediaQuery } from "@/hooks/use-media-query";

export interface ScreenshotNodeData {
  screenshotId: string;
  imageData: string;
  monitorIndex: number;
  width: number;
  height: number;
  capturedAt: string;
  label: string;
  [key: string]: unknown;
}

type ScreenshotNodeType = Node<ScreenshotNodeData>;

function ScreenshotNodeComponent({ id, data, selected }: NodeProps<ScreenshotNodeType>) {
  const { deleteNode } = useCanvas();
  const isMobile = useMediaQuery("(max-width: 767px)");
  const contentRef = useRef<HTMLDivElement>(null);

  const handleClose = useCallback(async () => {
    try {
      await deleteNode(id);
    } catch (err) {
      console.error("Failed to delete screenshot node:", err);
    }
  }, [id, deleteNode]);

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

  const capturedDate = data.capturedAt
    ? new Date(data.capturedAt).toLocaleTimeString()
    : "";

  return (
    <>
      <NodeResizer
        minWidth={isMobile ? 200 : 300}
        minHeight={isMobile ? 150 : 200}
        isVisible={!!selected}
        lineClassName="!border-accent-purple/40"
        handleClassName="!w-2 !h-2 !bg-accent-purple !border-0 !rounded-sm"
      />
      <Handle
        type="target"
        position={Position.Top}
        className="!w-1.5 !h-1.5 !bg-accent-purple/60 !border-0 !rounded-full"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-1.5 !h-1.5 !bg-accent-purple/60 !border-0 !rounded-full"
      />
      <div
        className={`flex h-full w-full flex-col overflow-hidden rounded-xl border border-accent-purple/15 ${
          isMobile ? "" : "shadow-[0_12px_40px_rgba(0,0,0,0.35)]"
        } bg-surface-raised`}
      >
        {/* Title bar */}
        <div className="drag-handle flex items-center justify-between border-b border-border-subtle px-3.5 min-h-[40px] py-2">
          <div className="flex items-center gap-2 min-w-0">
            <Camera className="h-3.5 w-3.5 shrink-0 text-accent-purple/60" />
            <span className="text-body-sm font-medium text-white/60">
              Screenshot
            </span>
            <span className="text-caption text-white/30">
              Monitor {data.monitorIndex + 1}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {capturedDate && (
              <span className="flex items-center gap-1 text-caption text-white/30">
                <Clock className="h-3 w-3" />
                {capturedDate}
              </span>
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
              title="Delete screenshot"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Screenshot image */}
        <div ref={contentRef} className="nodrag nopan nowheel relative flex-1 overflow-hidden p-2 bg-surface-raised">
          {data.imageData ? (
            <img
              src={`data:image/jpeg;base64,${data.imageData}`}
              alt={`Screenshot from monitor ${data.monitorIndex + 1}`}
              className="h-full w-full rounded-lg object-contain"
              draggable={false}
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <Camera className="h-8 w-8 text-accent-purple/20" />
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
            {data.width} x {data.height}
          </span>
        </div>
      </div>
    </>
  );
}

export const ScreenshotNode = memo(ScreenshotNodeComponent);
