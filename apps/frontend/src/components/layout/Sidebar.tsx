import { useState, useCallback } from "react";
import {
  LayoutDashboard,
  Code2,
  MessageSquare,
  Server,
  Settings,
  Link2,
  Check,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/hooks/use-workspace";
import type { ActiveView } from "./AppShell";

interface SidebarProps {
  activeView: ActiveView;
  onViewChange: (view: ActiveView) => void;
  unreadChat: number;
  onlineServices: number;
  collaboratorCount: number;
}

interface NavItem {
  id: ActiveView;
  icon: typeof LayoutDashboard;
  label: string;
  badge?: number;
}

export function Sidebar({
  activeView,
  onViewChange,
  unreadChat,
  onlineServices,
  collaboratorCount,
}: SidebarProps) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const { workspaceId, collaborator } = useWorkspace();

  const navItems: NavItem[] = [
    { id: "canvas", icon: LayoutDashboard, label: "Canvas" },
    { id: "editor", icon: Code2, label: "Editor" },
    { id: "chat", icon: MessageSquare, label: "Chat", badge: unreadChat },
    { id: "services", icon: Server, label: "Services", badge: onlineServices },
    { id: "settings", icon: Settings, label: "Settings" },
  ];

  const handleShare = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  }, []);

  return (
    <div
      className={cn(
        "flex h-full flex-col border-r border-border/60 bg-card/60 backdrop-blur-sm transition-[width] duration-200 ease-in-out",
        expanded ? "w-56" : "w-12",
      )}
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
    >
      {/* Logo area */}
      <div className="flex h-12 items-center px-3 border-b border-border/40">
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-accent-cyan/15">
          <span className="text-[10px] font-bold text-accent-cyan tracking-tighter">ET</span>
        </div>
        {expanded && (
          <span className="ml-2.5 text-xs font-semibold text-foreground tracking-tight truncate">
            Excaliterm
          </span>
        )}
      </div>

      {/* Nav items */}
      <nav className="flex flex-1 flex-col gap-0.5 px-1.5 pt-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              className={cn(
                "relative flex h-9 items-center gap-3 rounded-lg px-2 text-sm font-medium transition-all duration-150",
                isActive
                  ? "bg-accent-cyan/10 text-accent-cyan shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                  : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground",
              )}
              title={item.label}
            >
              <Icon className="h-4 w-4 shrink-0" strokeWidth={isActive ? 2 : 1.5} />
              {expanded && (
                <span className="truncate text-[13px]">{item.label}</span>
              )}
              {item.badge != null && item.badge > 0 && (
                <span
                  className={cn(
                    "absolute flex items-center justify-center rounded-full bg-accent-cyan text-[9px] font-bold text-background",
                    expanded
                      ? "right-2 h-[18px] min-w-[18px] px-1"
                      : "right-0 top-0.5 h-[14px] min-w-[14px] px-0.5 text-[8px]",
                  )}
                >
                  {item.badge > 99 ? "99+" : item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div className="border-t border-border/40 px-1.5 py-2 space-y-0.5">
        {/* Workspace ID */}
        {expanded && (
          <div className="px-2 py-1">
            <span className="font-mono text-[9px] text-muted-foreground/50 tracking-wider uppercase">
              Workspace
            </span>
            <p className="font-mono text-[10px] text-muted-foreground mt-0.5">
              {workspaceId}
            </p>
            <div className="mt-2 flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <Users className="h-3 w-3" />
              <span>
                {collaboratorCount} collaborator{collaboratorCount === 1 ? "" : "s"}
              </span>
            </div>
            <p className="mt-1 truncate text-[10px] text-muted-foreground/80">
              {collaborator.displayName}
            </p>
          </div>
        )}
        {/* Share button */}
        <button
          onClick={handleShare}
          className="flex h-9 w-full items-center gap-3 rounded-lg px-2 text-sm font-medium text-muted-foreground hover:bg-white/[0.04] hover:text-foreground transition-all duration-150"
          title="Copy workspace link"
        >
          {copied ? (
            <Check className="h-4 w-4 shrink-0 text-accent-green" strokeWidth={1.5} />
          ) : (
            <Link2 className="h-4 w-4 shrink-0" strokeWidth={1.5} />
          )}
          {expanded && (
            <span className="truncate text-[13px]">
              {copied ? "Link copied" : "Share workspace"}
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
