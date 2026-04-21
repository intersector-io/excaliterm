import {
  LayoutDashboard,
  Code2,
  MessageSquare,
  Server,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ActiveView } from "./AppShell";

interface BottomNavProps {
  activeView: ActiveView;
  onViewChange: (view: ActiveView) => void;
  unreadChat: number;
}

interface TabItem {
  id: ActiveView;
  icon: typeof LayoutDashboard;
  label: string;
  badge?: number;
}

export function BottomNav({ activeView, onViewChange, unreadChat }: BottomNavProps) {
  const tabs: TabItem[] = [
    { id: "canvas", icon: LayoutDashboard, label: "Canvas" },
    { id: "editor", icon: Code2, label: "Editor" },
    { id: "chat", icon: MessageSquare, label: "Chat", badge: unreadChat },
    { id: "services", icon: Server, label: "Services" },
    { id: "settings", icon: Settings, label: "Settings" },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 flex h-14 items-center border-t border-border bg-card">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeView === tab.id;

        return (
          <button
            key={tab.id}
            onClick={() => onViewChange(tab.id)}
            className={cn(
              "relative flex flex-1 flex-col items-center justify-center gap-0.5 py-1 transition-colors",
              isActive
                ? "text-foreground"
                : "text-muted-foreground",
            )}
          >
            <Icon className="h-5 w-5" />
            <span className="text-caption font-medium">{tab.label}</span>
            {tab.badge != null && tab.badge > 0 && (
              <span className="absolute right-1/4 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent-blue px-0.5 text-caption font-semibold text-white">
                {tab.badge > 99 ? "99+" : tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
