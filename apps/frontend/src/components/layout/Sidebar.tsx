import { Link2, Check } from "lucide-react";
import {
  LayoutDashboard,
  Code2,
  MessageSquare,
  Server,
} from "lucide-react";
import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";
import type { ActiveView } from "./AppShell";

interface SidebarProps {
  activeView: ActiveView;
  onViewChange: (view: ActiveView) => void;
  unreadChat: number;
  onlineServices: number;
  collaboratorCount: number;
  chatOpen: boolean;
  onToggleChat: () => void;
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
  chatOpen,
  onToggleChat,
}: SidebarProps) {
  const [copied, setCopied] = useState(false);

  const navItems: NavItem[] = [
    { id: "canvas", icon: LayoutDashboard, label: "Canvas" },
    { id: "editor", icon: Code2, label: "Editor" },
    { id: "services", icon: Server, label: "Hosts", badge: onlineServices },
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
    <TooltipProvider delayDuration={120}>
      <div className="flex h-full w-12 flex-col items-center border-r border-border-default/50 bg-background py-2">
        {/* Logo */}
        <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-md bg-accent-cyan/12">
          <span className="text-[11px] font-bold tracking-tight text-accent-cyan">
            ET
          </span>
        </div>

        {/* Nav items */}
        <nav className="flex flex-1 flex-col items-center gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;

            return (
              <Tooltip key={item.id}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => onViewChange(item.id)}
                    className={cn(
                      "relative flex h-9 w-9 items-center justify-center rounded-md transition-colors duration-100",
                      isActive
                        ? "bg-white/[0.08] text-foreground shadow-[inset_2px_0_0_var(--color-accent-cyan)]"
                        : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground",
                    )}
                  >
                    <Icon
                      className="h-[17px] w-[17px]"
                      strokeWidth={isActive ? 2 : 1.5}
                    />
                    {item.badge != null && item.badge > 0 && (
                      <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-accent-cyan px-0.5 text-[9px] font-bold text-background">
                        {item.badge > 99 ? "+" : item.badge}
                      </span>
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={8}>
                  <p className="text-xs font-medium">{item.label}</p>
                </TooltipContent>
              </Tooltip>
            );
          })}

          {/* Chat toggle — separate from view nav */}
          <div className="mt-1 pt-1 border-t border-border-subtle/50">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={onToggleChat}
                  className={cn(
                    "relative flex h-9 w-9 items-center justify-center rounded-md transition-colors duration-100",
                    chatOpen
                      ? "bg-white/[0.08] text-foreground shadow-[inset_2px_0_0_var(--color-accent-cyan)]"
                      : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground",
                  )}
                >
                  <MessageSquare
                    className="h-[17px] w-[17px]"
                    strokeWidth={chatOpen ? 2 : 1.5}
                  />
                  {!chatOpen && unreadChat > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-accent-cyan px-0.5 text-[9px] font-bold text-background">
                      {unreadChat > 99 ? "+" : unreadChat}
                    </span>
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>
                <p className="text-xs font-medium">
                  {chatOpen ? "Close chat" : "Chat"}
                </p>
              </TooltipContent>
            </Tooltip>
          </div>
        </nav>

        {/* Bottom — share */}
        <div className="mt-auto flex flex-col items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={handleShare}
                className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors duration-100 hover:bg-white/[0.04] hover:text-foreground"
              >
                {copied ? (
                  <Check className="h-[17px] w-[17px] text-accent-green" strokeWidth={1.5} />
                ) : (
                  <Link2 className="h-[17px] w-[17px]" strokeWidth={1.5} />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              <p className="text-xs font-medium">
                {copied ? "Link copied" : "Share workspace"}
              </p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  );
}
