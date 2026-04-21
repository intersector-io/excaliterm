import { useEffect, useState, useCallback } from "react";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useWorkspace } from "@/hooks/use-workspace";
import {
  useInitializeTerminalCollaboration,
  useTerminalCollaboration,
} from "@/hooks/use-terminal-collaboration";
import { startAll, stopAll } from "@/lib/signalr-client";
import { useChatStore } from "@/stores/chat-store";
import { useServices } from "@/hooks/use-services";
import { Sidebar } from "./Sidebar";
import { BottomNav } from "./BottomNav";
import { ViewRouter } from "./ViewRouter";
import { CommandPalette } from "@/components/command-palette/CommandPalette";

export type ActiveView = "canvas" | "editor" | "chat" | "services" | "settings";

export function AppShell() {
  const [activeView, setActiveView] = useState<ActiveView>("canvas");
  const unreadChat = useChatStore((s) => s.unreadCount);
  const resetUnread = useChatStore((s) => s.resetUnread);
  const { onlineCount: onlineServices } = useServices();
  const { workspaceId } = useWorkspace();
  useInitializeTerminalCollaboration();
  const { collaboratorCount } = useTerminalCollaboration();

  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const isMobile = useMediaQuery("(max-width: 767px)");
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  // Global Cmd+K / Ctrl+K listener
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCommandPaletteOpen(true);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Start SignalR connections (hubs already initialized in App.tsx)
  useEffect(() => {
    let cancelled = false;
    // Delay slightly to survive React StrictMode's mount/unmount/remount cycle
    const timer = setTimeout(() => {
      if (!cancelled) startAll();
    }, 50);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      stopAll();
    };
  }, [workspaceId]);

  // Reset unread when switching to chat view
  useEffect(() => {
    if (activeView === "chat") {
      resetUnread();
    }
  }, [activeView, resetUnread]);

  const palette = (
    <CommandPalette
      open={commandPaletteOpen}
      onClose={() => setCommandPaletteOpen(false)}
      onViewChange={setActiveView}
    />
  );

  if (isDesktop) {
    return (
      <div className="flex min-h-[100dvh] w-screen bg-background">
        <Sidebar
          activeView={activeView}
          onViewChange={setActiveView}
          unreadChat={unreadChat}
          onlineServices={onlineServices}
          collaboratorCount={collaboratorCount}
        />
        <main className="flex flex-1 flex-col overflow-hidden">
          <ViewRouter activeView={activeView} onViewChange={setActiveView} />
        </main>
        {palette}
      </div>
    );
  }

  if (isMobile) {
    return (
      <div className="flex min-h-[100dvh] w-screen flex-col bg-background">
        <main className="flex flex-1 flex-col overflow-hidden pb-14">
          <ViewRouter activeView={activeView} onViewChange={setActiveView} />
        </main>
        <BottomNav
          activeView={activeView}
          onViewChange={setActiveView}
          unreadChat={unreadChat}
        />
        {palette}
      </div>
    );
  }

  return (
    <div className="flex min-h-[100dvh] w-screen bg-background">
      <Sidebar
        activeView={activeView}
        onViewChange={setActiveView}
        unreadChat={unreadChat}
        onlineServices={onlineServices}
        collaboratorCount={collaboratorCount}
      />
      <main className="flex flex-1 flex-col overflow-hidden">
        <ViewRouter activeView={activeView} onViewChange={setActiveView} />
      </main>
      {palette}
    </div>
  );
}
