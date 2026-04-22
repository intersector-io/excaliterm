import { useState, useCallback } from "react";
import { toast } from "sonner";
import { useTerminals } from "@/hooks/use-terminal";
import { useNotes } from "@/hooks/use-notes";
import { useWorkspace } from "@/hooks/use-workspace";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useServices } from "@/hooks/use-services";
import { useTerminalCollaboration } from "@/hooks/use-terminal-collaboration";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import {
  Link2,
  Check,
  Terminal,
  StickyNote,
  Code2,
  Server,
  Users,
  Trash2,
  ChevronDown,
  Plus,
  List,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCanvas } from "@/hooks/use-canvas";
import { RegisterServiceDialog } from "@/components/services/RegisterServiceDialog";
import { ServiceConfigDialog } from "@/components/services/ServiceConfigDialog";
import type { ServiceInstance } from "@/lib/api-client";

interface HostActionMenuItemProps {
  noHost: boolean;
  onlineServices: ServiceInstance[];
  icon: React.ComponentType<{ className?: string }>;
  disabledLabel: string;
  singleLabel: string;
  multiLabel: string;
  isLoading?: boolean;
  onAction: (serviceInstanceId?: string) => void;
}

function HostActionMenuItem({
  noHost,
  onlineServices,
  icon: Icon,
  disabledLabel,
  singleLabel,
  multiLabel,
  isLoading,
  onAction,
}: Readonly<HostActionMenuItemProps>) {
  if (noHost) {
    return (
      <DropdownMenuItem disabled>
        <Icon className="h-3.5 w-3.5" />
        <span>{disabledLabel}</span>
      </DropdownMenuItem>
    );
  }

  if (onlineServices.length === 1) {
    return (
      <DropdownMenuItem onClick={() => onAction()} disabled={isLoading}>
        <Icon className="h-3.5 w-3.5" />
        <span>{isLoading ? "Creating..." : singleLabel}</span>
      </DropdownMenuItem>
    );
  }

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger disabled={isLoading}>
        <Icon className="h-3.5 w-3.5" />
        <span>{isLoading ? "Creating..." : multiLabel}</span>
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent>
        {onlineServices.map((s) => (
          <DropdownMenuItem key={s.id} onClick={() => onAction(s.id)}>
            <span className="h-2 w-2 rounded-full bg-accent-green" />
            <span className="truncate">{s.name}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}

function MobileTerminalButton({
  onlineServices,
  isCreating,
  noHost,
  onNewTerminal,
  onConnect,
}: Readonly<{
  onlineServices: ServiceInstance[];
  isCreating: boolean;
  noHost: boolean;
  onNewTerminal: (serviceInstanceId?: string) => void;
  onConnect: () => void;
}>) {
  if (onlineServices.length === 1) {
    return (
      <Button
        size="sm"
        variant="secondary"
        onClick={() => onNewTerminal()}
        disabled={isCreating || noHost}
        className={`h-7 gap-1 rounded-md px-2.5 text-caption ${
          noHost
            ? "border border-border-default/50 bg-muted/40 text-muted-foreground opacity-60"
            : "border border-accent-cyan/20 bg-accent-cyan/10 text-accent-cyan"
        }`}
      >
        <Terminal className="h-3 w-3" />
        {isCreating ? "..." : "Terminal"}
      </Button>
    );
  }

  if (onlineServices.length > 1) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="sm"
            variant="secondary"
            disabled={isCreating}
            className="h-7 gap-1 rounded-md border border-accent-cyan/20 bg-accent-cyan/10 px-2.5 text-caption text-accent-cyan"
          >
            <Terminal className="h-3 w-3" />
            {isCreating ? "..." : "Terminal"}
            <ChevronDown className="h-3 w-3 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel className="text-caption text-muted-foreground">
            Select host
          </DropdownMenuLabel>
          {onlineServices.map((s) => (
            <DropdownMenuItem key={s.id} onClick={() => onNewTerminal(s.id)}>
              <span className="h-2 w-2 rounded-full bg-accent-green" />
              <span className="truncate">{s.name}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <Button
      size="sm"
      variant="secondary"
      onClick={onConnect}
      className="h-7 gap-1 rounded-md border border-border-default/50 bg-muted/40 px-2.5 text-caption text-muted-foreground opacity-60"
    >
      <Terminal className="h-3 w-3" />
      Terminal
    </Button>
  );
}

interface CanvasToolbarProps {
  onOpenTerminalList?: () => void;
}

export function CanvasToolbar({ onOpenTerminalList }: Readonly<CanvasToolbarProps>) {
  const { createTerminal, isCreating, terminals, closeAllTerminals, isClosingAll } = useTerminals();
  const { createNote, isCreating: isCreatingNote } = useNotes();
  const { workspaceId, apiKey, collaborator } = useWorkspace();
  const { services, onlineCount, deleteService, isDeleting } = useServices();
  const { createEditorNode } = useCanvas();
  const { collaboratorCount } = useTerminalCollaboration();
  const isMobile = useMediaQuery("(max-width: 767px)");
  const [copied, setCopied] = useState(false);
  const [connectOpen, setConnectOpen] = useState(false);
  const [configService, setConfigService] = useState<ServiceInstance | null>(null);

  const noHost = onlineCount === 0;
  const onlineServices = services.filter((s) => s.status === "online");
  const activeTerminals = terminals.filter((t) => t.status === "active");
  const terminalCount = activeTerminals.length;
  const hostLabel = noHost ? "No host" : `${onlineCount} host${onlineCount === 1 ? "" : "s"}`;
  const terminalSuffix = terminalCount > 0 ? `, ${terminalCount} terminal${terminalCount === 1 ? "" : "s"}` : "";

  const handleShare = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(globalThis.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  }, []);

  async function onNewTerminal(serviceInstanceId?: string) {
    if (noHost) return;
    try {
      await createTerminal(serviceInstanceId ? { serviceInstanceId } : {});
      toast.success("Terminal created");
    } catch {
      toast.error("Failed to create terminal", {
        description: "The host service may have gone offline. Try again.",
      });
    }
  }

  async function onNewEditor(serviceInstanceId?: string) {
    if (noHost) return;
    try {
      const targetId = serviceInstanceId ?? onlineServices[0]?.id;
      if (!targetId) return;
      await createEditorNode({ serviceInstanceId: targetId });
    } catch {
      toast.error("Failed to open editor");
    }
  }

  async function onNewNote() {
    try {
      await createNote({});
    } catch {
      toast.error("Failed to create note");
    }
  }

  async function onCloseAll() {
    try {
      const result = await closeAllTerminals();
      toast.success(`Closed ${result.closed} terminal${result.closed === 1 ? "" : "s"}`);
    } catch {
      toast.error("Failed to close terminals");
    }
  }

  // ─── Mobile ────────────────────────────────────────────────────────────────

  if (isMobile) {
    return (
      <>
        <div className="flex h-11 items-center justify-between border-b border-border-default/50 bg-background px-3">
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
                onClick={() => noHost ? setConnectOpen(true) : undefined}
                className={`flex items-center gap-1 ${noHost ? "text-accent-amber" : "text-accent-green"}`}
              >
                <Server className="h-3 w-3" />
                {noHost ? "No host" : onlineCount}
              </button>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {terminalCount > 0 && (
              <button
                onClick={onOpenTerminalList}
                className="flex h-7 items-center gap-1 rounded-md border border-border-default/50 bg-surface-raised px-2 text-caption text-muted-foreground transition-colors hover:text-foreground"
              >
                <List className="h-3 w-3" />
                {terminalCount}
              </button>
            )}
            <MobileTerminalButton
              onlineServices={onlineServices}
              isCreating={isCreating}
              noHost={noHost}
              onNewTerminal={onNewTerminal}
              onConnect={() => setConnectOpen(true)}
            />
            <button
              onClick={handleShare}
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground"
              title="Share workspace"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-accent-green" />
              ) : (
                <Link2 className="h-3.5 w-3.5" />
              )}
            </button>
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
            open={!!configService}
            onOpenChange={(open) => { if (!open) setConfigService(null); }}
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

  // ─── Desktop ───────────────────────────────────────────────────────────────

  return (
    <>
      <div className="flex h-11 items-center justify-between border-b border-border-default/50 bg-background px-4">
        {/* Left: Breadcrumb + status */}
        <div className="flex min-w-0 items-center gap-2 text-body-sm">
          <span className="font-semibold text-foreground truncate">
            {collaborator.displayName}
          </span>
          <span className="text-muted-foreground/30">/</span>
          <span className="font-mono text-caption text-muted-foreground/60 hidden md:inline">
            {workspaceId.slice(0, 12)}
          </span>

          {/* Host status dropdown */}
          <DropdownMenu>
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
                    onClick={() => setConfigService(service)}
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
                    <Settings className="h-3 w-3 shrink-0 text-muted-foreground/50" />
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

        {/* Right: Actions */}
        <div className="flex items-center gap-1.5">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                variant="secondary"
                className="h-7 gap-1.5 rounded-md border border-border-default/50 px-3 text-xs"
              >
                <Plus className="h-3 w-3" />
                Add
                <ChevronDown className="h-3 w-3 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <HostActionMenuItem
                noHost={noHost}
                onlineServices={onlineServices}
                icon={Terminal}
                disabledLabel="No host connected"
                singleLabel="New Terminal"
                multiLabel="New Terminal"
                isLoading={isCreating}
                onAction={onNewTerminal}
              />
              <HostActionMenuItem
                noHost={noHost}
                onlineServices={onlineServices}
                icon={Code2}
                disabledLabel="No host connected"
                singleLabel="Open Editor"
                multiLabel="Open Editor"
                onAction={onNewEditor}
              />
              <DropdownMenuItem onClick={onNewNote} disabled={isCreatingNote}>
                <StickyNote className="h-3.5 w-3.5" />
                <span>{isCreatingNote ? "Creating..." : "New Note"}</span>
              </DropdownMenuItem>
              {noHost && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setConnectOpen(true)}>
                    <Server className="h-3.5 w-3.5" />
                    <span>Connect Host</span>
                  </DropdownMenuItem>
                </>
              )}
              {terminalCount > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={onCloseAll}
                    disabled={isClosingAll}
                    className="text-accent-red focus:text-accent-red"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>{isClosingAll ? "Closing..." : `Close all (${terminalCount})`}</span>
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          <button
            onClick={handleShare}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-white/[0.04] hover:text-foreground"
            title="Copy workspace link"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-accent-green" />
            ) : (
              <Link2 className="h-3.5 w-3.5" />
            )}
          </button>
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
          open={!!configService}
          onOpenChange={(open) => { if (!open) setConfigService(null); }}
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
