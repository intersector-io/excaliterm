import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useWorkspace } from "@/hooks/use-workspace";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useServices } from "@/hooks/use-services";
import { useTerminalCollaboration } from "@/hooks/use-terminal-collaboration";
import * as api from "@/lib/api-client";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Server, Users, ChevronDown, Plus, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { RegisterServiceDialog } from "@/components/services/RegisterServiceDialog";
import { ServiceConfigDialog } from "@/components/services/ServiceConfigDialog";
import type { ServiceInstance } from "@/lib/api-client";

interface CanvasToolbarProps {
  onFocusService?: (serviceId: string) => void;
}

export function CanvasToolbar({
  onFocusService,
}: Readonly<CanvasToolbarProps>) {
  const { workspaceId, apiKey, collaborator } = useWorkspace();
  const { services, onlineCount, deleteService, isDeleting } = useServices();
  const { collaboratorCount } = useTerminalCollaboration();
  const isMobile = useMediaQuery("(max-width: 767px)");
  const [connectOpen, setConnectOpen] = useState(false);
  const [configService, setConfigService] = useState<ServiceInstance | null>(
    null,
  );
  const [hostMenuOpen, setHostMenuOpen] = useState(false);

  const activeTerminalCount = useQuery({
    queryKey: ["terminals", workspaceId],
    queryFn: () => api.listTerminals(workspaceId),
    select: (data) => data.terminals.filter((t) => t.status === "active").length,
  }).data ?? 0;

  const noHost = onlineCount === 0;
  const hostLabel = noHost
    ? "No host"
    : `${onlineCount} host${onlineCount === 1 ? "" : "s"}`;
  const terminalSuffix =
    activeTerminalCount > 0
      ? `, ${activeTerminalCount} terminal${activeTerminalCount === 1 ? "" : "s"}`
      : "";

  if (isMobile) {
    return (
      <>
        <div className="flex h-11 items-center border-b border-border-default/50 bg-background px-3">
          <div className="min-w-0">
            <h1 className="text-body-sm font-semibold text-foreground">
              Canvas
            </h1>
            <div className="flex items-center gap-2 text-caption text-muted-foreground">
              <span className="truncate">{collaborator.displayName}</span>
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {collaboratorCount}
              </span>
              <button
                onClick={() =>
                  noHost ? setConnectOpen(true) : undefined
                }
                className={`flex items-center gap-1 ${noHost ? "text-accent-amber" : "text-accent-green"}`}
              >
                <Server className="h-3 w-3" />
                {noHost ? "No host" : onlineCount}
              </button>
            </div>
          </div>
        </div>

        <RegisterServiceDialog
          open={connectOpen}
          onOpenChange={setConnectOpen}
          workspaceId={workspaceId}
          apiKey={apiKey}
        />
        {configService && (
          <ServiceConfigDialog
            open
            onOpenChange={(open) => {
              if (!open) setConfigService(null);
            }}
            service={configService}
            workspaceId={workspaceId}
            apiKey={apiKey}
            onDelete={async () => {
              await deleteService(configService.id);
              setConfigService(null);
            }}
            isDeleting={isDeleting}
          />
        )}
      </>
    );
  }

  return (
    <>
      <div className="flex h-11 items-center border-b border-border-default/50 bg-background px-4">
        <div className="flex min-w-0 items-center gap-2 text-body-sm">
          <span className="truncate font-semibold text-foreground">
            {collaborator.displayName}
          </span>
          <span className="text-muted-foreground/30">/</span>
          <span className="hidden font-mono text-caption text-muted-foreground/60 md:inline">
            {workspaceId.slice(0, 12)}
          </span>

          <DropdownMenu open={hostMenuOpen} onOpenChange={setHostMenuOpen}>
            <DropdownMenuTrigger asChild>
              <button className="ml-1 inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-caption text-muted-foreground/60 transition-colors hover:bg-white/[0.04] hover:text-muted-foreground">
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    noHost ? "bg-accent-amber" : "bg-accent-green",
                  )}
                />
                {hostLabel}
                <ChevronDown className="h-3 w-3 opacity-50" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              {services.length === 0 ? (
                <div className="px-2 py-3 text-center text-xs text-muted-foreground">
                  No hosts connected yet
                </div>
              ) : (
                services.map((service) => (
                  <DropdownMenuItem
                    key={service.id}
                    onClick={() => onFocusService?.(service.id)}
                    className="gap-2"
                  >
                    <span
                      className={cn(
                        "h-2 w-2 shrink-0 rounded-full",
                        service.status === "online"
                          ? "bg-accent-green"
                          : "bg-muted-foreground/30",
                      )}
                    />
                    <span className="flex-1 truncate">{service.name}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setHostMenuOpen(false);
                        setConfigService(service);
                      }}
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground/50 transition-colors hover:bg-white/[0.08] hover:text-muted-foreground"
                    >
                      <Settings className="h-3 w-3" />
                    </button>
                  </DropdownMenuItem>
                ))
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setConnectOpen(true)}>
                <Plus className="h-3.5 w-3.5" />
                <span>Connect Host</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <span className="text-caption text-muted-foreground/40">
            {collaboratorCount} here{terminalSuffix}
          </span>
        </div>
      </div>

      <RegisterServiceDialog
        open={connectOpen}
        onOpenChange={setConnectOpen}
        workspaceId={workspaceId}
        apiKey={apiKey}
      />
      {configService && (
        <ServiceConfigDialog
          open
          onOpenChange={(open) => {
            if (!open) setConfigService(null);
          }}
          service={configService}
          workspaceId={workspaceId}
          apiKey={apiKey}
          onDelete={async () => {
            await deleteService(configService.id);
            setConfigService(null);
          }}
          isDeleting={isDeleting}
        />
      )}
    </>
  );
}
