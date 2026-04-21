import { Suspense, lazy, useState, useRef, useCallback } from "react";
import { Settings } from "lucide-react";
import { CanvasToolbar } from "@/components/canvas/CanvasToolbar";
import { InfiniteCanvas } from "@/components/canvas/InfiniteCanvas";
import { CanvasEmptyState } from "@/components/canvas/CanvasEmptyState";
import { TerminalListPanel } from "@/components/canvas/TerminalListPanel";
import { MobileTerminalListView } from "@/components/canvas/MobileTerminalListView";
import { useCanvas } from "@/hooks/use-canvas";
import { useMediaQuery } from "@/hooks/use-media-query";
import type { ActiveView } from "./AppShell";

const EditorView = lazy(() =>
  import("@/components/editor/EditorView").then((m) => ({ default: m.EditorView })),
);
const ChatView = lazy(() =>
  import("@/components/chat/ChatView").then((m) => ({ default: m.ChatView })),
);
const ServicesView = lazy(() =>
  import("@/components/services/ServicesView").then((m) => ({ default: m.ServicesView })),
);

interface ViewRouterProps {
  activeView: ActiveView;
  onViewChange: (view: ActiveView) => void;
}

function ViewLoadingFallback() {
  return (
    <div className="flex h-full items-center justify-center text-muted-foreground">
      <p className="text-sm">Loading...</p>
    </div>
  );
}

function SettingsView() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-border px-3">
        <Settings className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium text-foreground">Settings</span>
      </div>
      <div className="flex flex-1 items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-border/40 bg-surface-raised/40">
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

function CanvasView({ onViewChange }: { onViewChange: (view: ActiveView) => void }) {
  const { nodes } = useCanvas();
  const isMobile = useMediaQuery("(max-width: 767px)");
  const [terminalListOpen, setTerminalListOpen] = useState(false);
  const focusTerminalRef = useRef<((nodeId: string) => void) | null>(null);
  const fullScreenRef = useRef<((terminalId: string, status: string) => void) | null>(null);

  const handleFocusTerminal = useCallback((nodeId: string) => {
    focusTerminalRef.current?.(nodeId);
  }, []);

  const handleFullScreenTerminal = useCallback((terminalId: string, status: string) => {
    fullScreenRef.current?.(terminalId, status);
  }, []);

  // On mobile, show a terminal list instead of the canvas
  if (isMobile) {
    return (
      <MobileTerminalListView
        onNavigateToServices={() => onViewChange("services")}
      />
    );
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <CanvasToolbar onOpenTerminalList={() => setTerminalListOpen(true)} />
      <div className="relative min-h-0 flex-1">
        <InfiniteCanvas onFocusTerminalRef={focusTerminalRef} onFullScreenRef={fullScreenRef} />
        {nodes.length === 0 && (
          <CanvasEmptyState
            onNavigateToServices={() => onViewChange("services")}
          />
        )}
      </div>
      <TerminalListPanel
        open={terminalListOpen}
        onClose={() => setTerminalListOpen(false)}
        onFocusTerminal={handleFocusTerminal}
        onFullScreenTerminal={handleFullScreenTerminal}
      />
    </div>
  );
}

export function ViewRouter({ activeView, onViewChange }: ViewRouterProps) {
  switch (activeView) {
    case "canvas":
      return <CanvasView onViewChange={onViewChange} />;
    case "editor":
      return (
        <Suspense fallback={<ViewLoadingFallback />}>
          <EditorView />
        </Suspense>
      );
    case "chat":
      return (
        <Suspense fallback={<ViewLoadingFallback />}>
          <ChatView isActive={activeView === "chat"} />
        </Suspense>
      );
    case "services":
      return (
        <Suspense fallback={<ViewLoadingFallback />}>
          <ServicesView />
        </Suspense>
      );
    case "settings":
      return <SettingsView />;
    default:
      return null;
  }
}
