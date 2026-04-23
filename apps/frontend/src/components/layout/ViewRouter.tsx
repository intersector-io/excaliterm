import { useRef, useCallback, useEffect } from "react";
import { Settings } from "lucide-react";
import { CanvasToolbar } from "@/components/canvas/CanvasToolbar";
import { InfiniteCanvas } from "@/components/canvas/InfiniteCanvas";
import { CanvasEmptyState } from "@/components/canvas/CanvasEmptyState";
import { TerminalDock } from "@/components/canvas/TerminalDock";
import { MobileTerminalListView } from "@/components/canvas/MobileTerminalListView";
import { useCanvas, type HostNodeData } from "@/hooks/use-canvas";
import { useMediaQuery } from "@/hooks/use-media-query";
import type { ActiveView } from "./AppShell";

interface ViewRouterProps {
  activeView: ActiveView;
}

function SettingsView() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-border-default px-3">
        <Settings className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium text-foreground">Settings</span>
      </div>
      <div className="flex flex-1 items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-border/40 bg-surface-raised/40">
            <Settings className="h-5 w-5 text-muted-foreground/50" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground/80">Settings</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Workspace configuration coming soon
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function CanvasView() {
  const { nodes } = useCanvas();
  const isMobile = useMediaQuery("(max-width: 767px)");
  const focusTerminalRef = useRef<((nodeId: string) => void) | null>(null);
  const fullScreenRef = useRef<
    ((terminalId: string, status: string) => void) | null
  >(null);

  const handleFocusTerminal = useCallback((nodeId: string) => {
    focusTerminalRef.current?.(nodeId);
  }, []);

  const nodesRef = useRef(nodes);
  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  const handleFocusService = useCallback((serviceId: string) => {
    const hostNode = nodesRef.current.find(
      (n) =>
        n.type === "host" &&
        (n.data as HostNodeData).serviceInstanceId === serviceId,
    );
    if (hostNode) {
      focusTerminalRef.current?.(hostNode.id);
    }
  }, []);

  const handleFullScreenTerminal = useCallback(
    (terminalId: string, status: string) => {
      fullScreenRef.current?.(terminalId, status);
    },
    [],
  );

  if (isMobile) {
    return <MobileTerminalListView />;
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <CanvasToolbar onFocusService={handleFocusService} />
      <div className="relative min-h-0 flex-1">
        <InfiniteCanvas
          onFocusTerminalRef={focusTerminalRef}
          onFullScreenRef={fullScreenRef}
        />
        {nodes.length === 0 && <CanvasEmptyState />}
        <TerminalDock
          onFocusTerminal={handleFocusTerminal}
          onFullScreenTerminal={handleFullScreenTerminal}
        />
      </div>
    </div>
  );
}

export function ViewRouter({ activeView }: Readonly<ViewRouterProps>) {
  switch (activeView) {
    case "canvas":
      return <CanvasView />;
    case "settings":
      return <SettingsView />;
    default:
      return null;
  }
}
