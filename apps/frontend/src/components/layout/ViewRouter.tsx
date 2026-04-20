import { Suspense, lazy } from "react";
import { CanvasToolbar } from "@/components/canvas/CanvasToolbar";
import { InfiniteCanvas } from "@/components/canvas/InfiniteCanvas";
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
    <div className="flex h-full items-center justify-center text-muted-foreground">
      <div className="text-center">
        <p className="text-lg font-medium text-foreground">Settings</p>
        <p className="mt-1 text-sm">Coming soon</p>
      </div>
    </div>
  );
}

export function ViewRouter({ activeView }: ViewRouterProps) {
  switch (activeView) {
    case "canvas":
      return (
        <div className="flex h-full flex-col">
          <CanvasToolbar />
          <div className="flex-1 overflow-hidden">
            <InfiniteCanvas />
          </div>
        </div>
      );
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
