import { memo, useCallback } from "react";
import { type NodeProps, NodeResizer, Handle, Position, type Node } from "@xyflow/react";
import { Server, Terminal, Code2 } from "lucide-react";
import { toast } from "sonner";
import { useServices } from "@/hooks/use-services";
import { useTerminals } from "@/hooks/use-terminal";
import { useCanvas, type HostNodeData } from "@/hooks/use-canvas";
import { cn } from "@/lib/utils";

type HostNodeType = Node<HostNodeData>;

function HostNodeComponent({ data, selected }: NodeProps<HostNodeType>) {
  const { services } = useServices();
  const { createTerminal, isCreating } = useTerminals();
  const { createEditorNode } = useCanvas();

  const service = services.find((s) => s.id === data.serviceInstanceId);
  const isOnline = service?.status === "online";

  const handleNewTerminal = useCallback(async () => {
    if (!isOnline) {
      toast.error("Host is offline");
      return;
    }
    try {
      await createTerminal({ serviceInstanceId: data.serviceInstanceId });
      toast.success("Terminal created");
    } catch {
      toast.error("Failed to create terminal");
    }
  }, [data.serviceInstanceId, isOnline, createTerminal]);

  const handleOpenEditor = useCallback(async () => {
    if (!isOnline) {
      toast.error("Host is offline");
      return;
    }
    try {
      await createEditorNode({ serviceInstanceId: data.serviceInstanceId });
    } catch {
      toast.error("Failed to open editor");
    }
  }, [data.serviceInstanceId, isOnline, createEditorNode]);

  return (
    <>
      <NodeResizer
        minWidth={220}
        minHeight={120}
        isVisible={!!selected}
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
        className={cn(
          "flex h-full w-full flex-col overflow-hidden rounded-xl border shadow-[0_12px_40px_rgba(0,0,0,0.35)] bg-surface-raised transition-opacity",
          isOnline ? "border-accent-green/15" : "border-border-subtle opacity-50",
        )}
      >
        {/* Title bar */}
        <div className="flex items-center justify-between border-b border-border-subtle px-3.5 drag-handle min-h-[40px] py-1.5">
          <div className="flex items-center gap-2 min-w-0">
            <Server className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate text-body-sm font-medium text-foreground">
              {data.serviceName}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                isOnline ? "bg-accent-green" : "bg-muted-foreground/30",
              )}
            />
            <span className={cn(
              "text-caption",
              isOnline ? "text-accent-green" : "text-muted-foreground/50",
            )}>
              {isOnline ? "Online" : "Offline"}
            </span>
          </div>
        </div>

        {/* Body */}
        <div className="nodrag nopan flex flex-1 flex-col justify-between p-3">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-caption text-muted-foreground">
              <span className="font-mono text-caption">
                {data.serviceId.length > 20
                  ? `${data.serviceId.slice(0, 20)}...`
                  : data.serviceId}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="mt-2 flex items-center gap-1.5">
            <button
              onClick={handleNewTerminal}
              disabled={!isOnline || isCreating}
              className="flex h-7 items-center gap-1.5 rounded-md border border-border-subtle px-2.5 text-caption text-muted-foreground transition-colors hover:bg-white/[0.06] hover:text-foreground disabled:opacity-40 disabled:pointer-events-none"
            >
              <Terminal className="h-3 w-3" />
              Terminal
            </button>
            <button
              onClick={handleOpenEditor}
              disabled={!isOnline}
              className="flex h-7 items-center gap-1.5 rounded-md border border-border-subtle px-2.5 text-caption text-muted-foreground transition-colors hover:bg-white/[0.06] hover:text-foreground disabled:opacity-40 disabled:pointer-events-none"
            >
              <Code2 className="h-3 w-3" />
              Editor
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export const HostNode = memo(HostNodeComponent);
