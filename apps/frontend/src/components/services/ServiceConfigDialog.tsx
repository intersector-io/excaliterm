import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ServiceInstance } from "@/lib/api-client";

interface ServiceConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  service: ServiceInstance;
  onSave: (data: { name?: string; whitelistedPaths?: string }) => Promise<unknown>;
  isSaving: boolean;
  onDelete: () => Promise<unknown>;
  isDeleting: boolean;
}

export function ServiceConfigDialog({
  open,
  onOpenChange,
  service,
  onSave,
  isSaving,
  onDelete,
  isDeleting,
}: ServiceConfigDialogProps) {
  const [name, setName] = useState(service.name);
  const [whitelistedPaths, setWhitelistedPaths] = useState(
    service.whitelistedPaths ?? "",
  );
  const [confirmDelete, setConfirmDelete] = useState(false);

  function handleClose(value: boolean) {
    if (!value) {
      setName(service.name);
      setWhitelistedPaths(service.whitelistedPaths ?? "");
      setConfirmDelete(false);
    }
    onOpenChange(value);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    await onSave({
      name: name.trim(),
      whitelistedPaths: whitelistedPaths.trim(),
    });
    handleClose(false);
  }

  async function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    await onDelete();
    handleClose(false);
  }

  const hasChanges =
    name.trim() !== service.name ||
    whitelistedPaths.trim() !== (service.whitelistedPaths ?? "");

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Configure Service</DialogTitle>
          <DialogDescription>
            Update settings for "{service.name}".
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-service-name">Service Name</Label>
            <Input
              id="edit-service-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-whitelisted-paths">
              Whitelisted Paths
            </Label>
            <textarea
              id="edit-whitelisted-paths"
              className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              placeholder={"C:\\Scripts\nC:\\Tools"}
              value={whitelistedPaths}
              onChange={(e) => setWhitelistedPaths(e.target.value)}
            />
            <p className="text-caption text-muted-foreground">
              One path per line. Only these paths will be accessible.
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleClose(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!hasChanges || isSaving}>
              {isSaving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </form>

        {/* Delete section */}
        <div className="border-t border-border pt-4">
          <Button
            type="button"
            variant={confirmDelete ? "destructive" : "ghost"}
            size="sm"
            className="w-full gap-1.5 text-xs text-destructive hover:text-destructive"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {confirmDelete
              ? isDeleting
                ? "Deleting..."
                : "Click again to confirm deletion"
              : "Delete this service"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
