import { useEffect, useState, useCallback } from "react";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useWorkspace } from "@/hooks/use-workspace";
import { useInitializeTerminalCollaboration } from "@/hooks/use-terminal-collaboration";
import { startAll, stopAll } from "@/lib/signalr-client";
import { useChatStore } from "@/stores/chat-store";
import { Sidebar } from "./Sidebar";
import { BottomNav } from "./BottomNav";
import { ViewRouter } from "./ViewRouter";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { CommandPalette } from "@/components/command-palette/CommandPalette";

export type ActiveView = "canvas" | "settings";

export function AppShell() {
  const [activeView, setActiveView] = useState<ActiveView>("canvas");
  const [chatOpen, setChatOpen] = useState(false);
  const unreadChat = useChatStore((s) => s.unreadCount);
  const resetUnread = useChatStore((s) => s.resetUnread);
  const { workspaceId } = useWorkspace();
  useInitializeTerminalCollaboration();

  const isMobile = useMediaQuery("(max-width: 767px)");
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  const toggleChat = useCallback(() => {
    setChatOpen((prev) => !prev);
  }, []);

  // Global keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCommandPaletteOpen(true);
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "C") {
        e.preventDefault();
        setChatOpen((prev) => !prev);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Start SignalR connections (hubs already initialized in App.tsx)
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      if (!cancelled) startAll();
    }, 50);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      stopAll();
    };
  }, [workspaceId]);

  // Reset unread when chat panel is open
  useEffect(() => {
    if (chatOpen) {
      resetUnread();
    }
  }, [chatOpen, resetUnread]);

  const palette = (
    <CommandPalette
      open={commandPaletteOpen}
      onClose={() => setCommandPaletteOpen(false)}
      onViewChange={setActiveView}
    />
  );

  if (isMobile) {
    return (
      <div className="flex min-h-[100dvh] w-screen flex-col bg-background">
        <main className="flex flex-1 flex-col overflow-hidden pb-14">
          <ViewRouter activeView={activeView} />
        </main>
        <BottomNav
          activeView={activeView}
          onViewChange={setActiveView}
          unreadChat={unreadChat}
          onToggleChat={toggleChat}
          chatOpen={chatOpen}
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
        chatOpen={chatOpen}
        onToggleChat={toggleChat}
      />
      <main className="flex flex-1 overflow-hidden">
        <div className="flex flex-1 flex-col overflow-hidden">
          <ViewRouter activeView={activeView} />
        </div>
        <ChatPanel open={chatOpen} onClose={toggleChat} />
      </main>
      {palette}
    </div>
  );
}
