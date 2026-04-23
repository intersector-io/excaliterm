import {
  LayoutDashboard,
  MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTerminals } from "@/hooks/use-terminal";
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

export function BottomNav({ activeView, onViewChange, unreadChat }: Readonly<BottomNavProps>) {
  const { terminals } = useTerminals();
  const activeCount = terminals.filter((t) => t.status === "active").length;

  const tabs: TabItem[] = [
    { id: "canvas", icon: LayoutDashboard, label: "Canvas" },
    { id: "chat", icon: MessageSquare, label: "Chat", badge: unreadChat },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 flex h-14 items-center border-t border-border-default/50 bg-background">
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
            <Icon className="h-[18px] w-[18px]" strokeWidth={isActive ? 2 : 1.5} />
            <span className="text-caption font-medium">{tab.label}</span>
            {tab.badge != null && tab.badge > 0 && !isActive && (
              <span className="absolute right-1/4 top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-accent-cyan px-0.5 text-[9px] font-bold text-background">
                {tab.badge > 99 ? "99+" : tab.badge}
              </span>
            )}
            {/* Contextual status pill on canvas tab */}
            {tab.id === "canvas" && activeCount > 0 && (
              <span className="absolute -right-1 top-1/2 -translate-y-1/2 flex items-center gap-1 rounded-full bg-surface-raised/80 px-1.5 py-0.5">
                <span className="h-1.5 w-1.5 rounded-full bg-accent-green animate-pulse" />
                <span className="text-[9px] font-mono font-medium text-muted-foreground/70">{activeCount}</span>
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
