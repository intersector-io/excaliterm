import { useState } from "react";
import { Plus, Server } from "lucide-react";
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
  const { workspaceId } = useWorkspace();
  const {
    services,
    onlineCount,
    isLoading,
    registerService,
    isRegistering,
    updateService,
    isUpdating,
    deleteService,
    isDeleting,
  } = useServices();

  const [registerOpen, setRegisterOpen] = useState(false);
  const [editingService, setEditingService] = useState<ServiceInstance | null>(null);
  const [deletingService, setDeletingService] = useState<ServiceInstance | null>(null);

  function handleDelete(service: ServiceInstance) {
    setDeletingService(service);
  }

  async function confirmDelete() {
    if (!deletingService) return;
    await deleteService(deletingService.id);
    setDeletingService(null);
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <p className="text-sm">Loading services...</p>
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
          Register Service
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
              <p className="mt-1 text-xs">
                Register one to get started.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="mt-2 gap-1.5"
              onClick={() => setRegisterOpen(true)}
            >
              <Plus className="h-3.5 w-3.5" />
              Register Service
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
              />
            ))}
          </div>
        )}
      </div>

      {/* Register dialog */}
      <RegisterServiceDialog
        open={registerOpen}
        onOpenChange={setRegisterOpen}
        onRegister={registerService}
        isRegistering={isRegistering}
        workspaceId={workspaceId}
      />

      {/* Edit dialog */}
      {editingService && (
        <ServiceConfigDialog
          open={!!editingService}
          onOpenChange={(open) => {
            if (!open) setEditingService(null);
          }}
          service={editingService}
          onSave={(data) =>
            updateService({ id: editingService.id, data })
          }
          isSaving={isUpdating}
          onDelete={async () => {
            await deleteService(editingService.id);
            setEditingService(null);
          }}
          isDeleting={isDeleting}
        />
      )}

      {/* Delete confirmation dialog */}
      {deletingService && (
        <DeleteConfirmDialog
          serviceName={deletingService.name}
          open={!!deletingService}
          onOpenChange={(open) => {
            if (!open) setDeletingService(null);
          }}
          onConfirm={confirmDelete}
          isDeleting={isDeleting}
        />
      )}
    </div>
  );
}

function DeleteConfirmDialog({
  serviceName,
  open,
  onOpenChange,
  onConfirm,
  isDeleting,
}: {
  serviceName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
  isDeleting: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Delete Service</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete "{serviceName}"? This action
            cannot be undone.
          </DialogDescription>
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
            disabled={isDeleting}
          >
            {isDeleting ? "Deleting..." : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
