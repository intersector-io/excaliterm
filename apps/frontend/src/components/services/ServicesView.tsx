import { useState } from "react";
import { Plus, Server } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useServices } from "@/hooks/use-services";
import { useWorkspace } from "@/hooks/use-workspace";
import { ServiceCard } from "./ServiceCard";
import { RegisterServiceDialog } from "./RegisterServiceDialog";
import { ServiceConfigDialog } from "./ServiceConfigDialog";
import type { ServiceInstance } from "@/lib/api-client";

export function ServicesView() {
  const { workspaceId, apiKey } = useWorkspace();
  const {
    services,
    onlineCount,
    isLoading,
    deleteService,
    isDeleting,
    shutdownService,
    isShuttingDown,
  } = useServices();

  const [registerOpen, setRegisterOpen] = useState(false);
  const [editingService, setEditingService] = useState<ServiceInstance | null>(null);
  const [deletingService, setDeletingService] = useState<ServiceInstance | null>(null);
  const [shuttingDownService, setShuttingDownService] = useState<ServiceInstance | null>(null);

  function handleDelete(service: ServiceInstance) {
    setDeletingService(service);
  }

  async function confirmDelete() {
    if (!deletingService) return;
    await deleteService(deletingService.id);
    setDeletingService(null);
  }

  function handleShutdown(service: ServiceInstance) {
    setShuttingDownService(service);
  }

  async function confirmShutdown() {
    if (!shuttingDownService) return;
    try {
      await shutdownService(shuttingDownService.serviceId);
      toast.success(`Shutdown initiated for ${shuttingDownService.name}`);
    } catch {
      toast.error("Failed to initiate shutdown");
    }
    setShuttingDownService(null);
  }

  if (isLoading) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-6">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-8 w-36 rounded-lg" />
        </div>
        <div className="flex-1 p-4 sm:p-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-lg border border-border bg-surface-raised p-4 space-y-3">
                <div className="flex justify-between">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-14 rounded-full" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-3 w-36" />
                  <Skeleton className="h-3 w-32" />
                </div>
                <div className="flex gap-2 pt-1">
                  <Skeleton className="h-7 w-14 rounded-md" />
                  <Skeleton className="h-7 w-16 rounded-md" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <h1 className="text-base font-semibold text-foreground">Services</h1>
          <span className="text-xs text-muted-foreground">
            {services.length} total, {onlineCount} online
          </span>
        </div>
        <Button
          size="sm"
          className="gap-1.5"
          onClick={() => setRegisterOpen(true)}
        >
          <Plus className="h-3.5 w-3.5" />
          Connect Host
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {services.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
            <Server className="h-10 w-10 opacity-40" />
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">
                No services registered
              </p>
              <p className="mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">
                Connect your first host machine to start creating terminal
                sessions. Services run the Excaliterm agent and provide shell
                access.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="mt-2 gap-1.5"
              onClick={() => setRegisterOpen(true)}
            >
              <Plus className="h-3.5 w-3.5" />
              Connect Host
            </Button>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((service) => (
              <ServiceCard
                key={service.id}
                service={service}
                onEdit={setEditingService}
                onDelete={handleDelete}
                onShutdown={handleShutdown}
              />
            ))}
          </div>
        )}
      </div>

      {/* Register dialog */}
      <RegisterServiceDialog
        open={registerOpen}
        onOpenChange={setRegisterOpen}
        workspaceId={workspaceId}
        apiKey={apiKey}
      />

      {/* Edit dialog */}
      {editingService && (
        <ServiceConfigDialog
          open={!!editingService}
          onOpenChange={(open) => {
            if (!open) setEditingService(null);
          }}
          service={editingService}
          workspaceId={workspaceId}
          apiKey={apiKey}
          onDelete={async () => {
            await deleteService(editingService.id);
            setEditingService(null);
          }}
          isDeleting={isDeleting}
        />
      )}

      {/* Delete confirmation dialog */}
      {deletingService && (
        <ConfirmDialog
          title="Delete Service"
          description={`Are you sure you want to delete "${deletingService.name}"? This action cannot be undone.`}
          confirmLabel="Delete"
          loadingLabel="Deleting..."
          open={!!deletingService}
          onOpenChange={(open) => {
            if (!open) setDeletingService(null);
          }}
          onConfirm={confirmDelete}
          isLoading={isDeleting}
        />
      )}

      {/* Shutdown confirmation dialog */}
      {shuttingDownService && (
        <ConfirmDialog
          title="Shutdown Host"
          description={`This will shut down the remote host machine running "${shuttingDownService.name}". All active terminals and screen shares on this host will be terminated. This action cannot be undone remotely.`}
          confirmLabel="Shutdown"
          loadingLabel="Shutting down..."
          open={!!shuttingDownService}
          onOpenChange={(open) => {
            if (!open) setShuttingDownService(null);
          }}
          onConfirm={confirmShutdown}
          isLoading={isShuttingDown}
        />
      )}
    </div>
  );
}

interface ConfirmDialogProps {
  title: string;
  description: string;
  confirmLabel: string;
  loadingLabel: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
  isLoading: boolean;
}

function ConfirmDialog({
  title,
  description,
  confirmLabel,
  loadingLabel,
  open,
  onOpenChange,
  onConfirm,
  isLoading,
}: Readonly<ConfirmDialogProps>) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading ? loadingLabel : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
