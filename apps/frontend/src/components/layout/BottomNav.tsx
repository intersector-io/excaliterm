import {
  LayoutDashboard,
  Code2,
  MessageSquare,
  Server,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ActiveView } from "./AppShell";

interface BottomNavProps {
  activeView: ActiveView;
  onViewChange: (view: ActiveView) => void;
  unreadChat: number;
  onToggleChat: () => void;
  chatOpen: boolean;
}

interface TabItem {
  id: ActiveView | "chat";
  icon: typeof LayoutDashboard;
  label: string;
  badge?: number;
}

export function BottomNav({ activeView, onViewChange, unreadChat, onToggleChat, chatOpen }: BottomNavProps) {
  const tabs: TabItem[] = [
    { id: "canvas", icon: LayoutDashboard, label: "Canvas" },
    { id: "editor", icon: Code2, label: "Editor" },
    { id: "chat", icon: MessageSquare, label: "Chat", badge: unreadChat },
    { id: "services", icon: Server, label: "Hosts" },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 flex h-14 items-center border-t border-border-default/50 bg-background">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isChat = tab.id === "chat";
        const isActive = isChat ? chatOpen : activeView === tab.id;

        return (
          <button
            key={tab.id}
            onClick={() => {
              if (isChat) {
                onToggleChat();
              } else {
                onViewChange(tab.id as ActiveView);
              }
            }}
            className={cn(
              "relative flex flex-1 flex-col items-center justify-center gap-0.5 py-1 transition-colors",
              isActive
                ? "text-foreground"
                : "text-muted-foreground",
            )}
          >
            <Icon className="h-[18px] w-[18px]" strokeWidth={isActive ? 2 : 1.5} />
            <span className="text-caption font-medium">{tab.label}</span>
            {tab.badge != null && tab.badge > 0 && !isActive && (
              <span className="absolute right-1/4 top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-accent-cyan px-0.5 text-[9px] font-bold text-background">
                {tab.badge > 99 ? "99+" : tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
