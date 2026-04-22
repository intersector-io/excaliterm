import { Settings, Trash2, Clock, Terminal, FolderOpen, Power } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/lib/format-time";
import type { ServiceInstance } from "@/lib/api-client";

interface ServiceCardProps {
  service: ServiceInstance;
  onEdit: (service: ServiceInstance) => void;
  onDelete: (service: ServiceInstance) => void;
  onShutdown: (service: ServiceInstance) => void;
}

export function ServiceCard({ service, onEdit, onDelete, onShutdown }: Readonly<ServiceCardProps>) {
  const isOnline = service.status === "online";
  const paths = service.whitelistedPaths
    ? service.whitelistedPaths
        .split("\n")
        .map((p) => p.trim())
        .filter(Boolean)
    : [];

  return (
    <div className="rounded-lg border border-border bg-surface-raised p-4 transition-colors hover:border-muted-foreground/25">
      {/* Header row: name + status */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-foreground">
            {service.name}
          </h3>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span
            className={cn(
              "inline-block h-2 w-2 rounded-full",
              isOnline ? "bg-accent-green" : "bg-accent-red",
            )}
          />
          <span
            className={cn(
              "text-xs font-medium",
              isOnline ? "text-accent-green" : "text-muted-foreground",
            )}
          >
            {isOnline ? "Online" : "Offline"}
          </span>
        </div>
      </div>

      {/* Meta info */}
      <div className="mt-3 flex flex-col gap-1.5">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="h-3 w-3 shrink-0" />
          <span>Last seen: {formatRelativeTime(service.lastSeen)}</span>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Terminal className="h-3 w-3 shrink-0" />
          <span>Service ID: {service.serviceId.slice(0, 8)}...</span>
        </div>

        {paths.length > 0 && (
          <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <FolderOpen className="mt-0.5 h-3 w-3 shrink-0" />
            <span>
              {paths.slice(0, 2).join(", ")}
              {paths.length > 2 && ` +${paths.length - 2} more`}
            </span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="mt-4 flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 px-2 text-xs"
          onClick={() => onEdit(service)}
        >
          <Settings className="h-3 w-3" />
          Setup
        </Button>
        {isOnline && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 px-2 text-xs text-destructive hover:text-destructive"
            onClick={() => onShutdown(service)}
          >
            <Power className="h-3 w-3" />
            Shutdown
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 px-2 text-xs text-destructive hover:text-destructive"
          onClick={() => onDelete(service)}
        >
          <Trash2 className="h-3 w-3" />
          Delete
        </Button>
      </div>
    </div>
  );
}
