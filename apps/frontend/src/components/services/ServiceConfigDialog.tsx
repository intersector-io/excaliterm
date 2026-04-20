import { useState } from "react";
import { Copy, Check, AlertTriangle, RefreshCw } from "lucide-react";
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
import { copyToClipboard } from "@/lib/clipboard";
import type { ServiceInstance } from "@/lib/api-client";

interface ServiceConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  service: ServiceInstance;
  onSave: (data: { name?: string; whitelistedPaths?: string }) => Promise<unknown>;
  isSaving: boolean;
  onRegenerateKey: () => Promise<{ apiKey: string }>;
  isRegeneratingKey: boolean;
  onDelete: () => Promise<unknown>;
  isDeleting: boolean;
}

export function ServiceConfigDialog({
  open,
  onOpenChange,
  service,
  onSave,
  isSaving,
  onRegenerateKey,
  isRegeneratingKey,
  onDelete,
  isDeleting,
}: ServiceConfigDialogProps) {
  const [name, setName] = useState(service.name);
  const [whitelistedPaths, setWhitelistedPaths] = useState(
    service.whitelistedPaths ?? "",
  );
  const [regeneratedKey, setRegeneratedKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  function handleClose(value: boolean) {
    if (!value) {
      setName(service.name);
      setWhitelistedPaths(service.whitelistedPaths ?? "");
      setRegeneratedKey(null);
      setCopiedKey(false);
      setConfirmRegenerate(false);
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

  async function handleRegenerate() {
    if (!confirmRegenerate) {
      setConfirmRegenerate(true);
      return;
    }
    const result = await onRegenerateKey();
    setRegeneratedKey(result.apiKey);
    setConfirmRegenerate(false);
  }

  async function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    await onDelete();
    handleClose(false);
  }

  async function handleCopyKey() {
    if (!regeneratedKey) return;
    await copyToClipboard(regeneratedKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
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
            <p className="text-[11px] text-muted-foreground">
              One path per line. Only these paths will be accessible.
            </p>
          </div>

          {/* Regenerate API Key section */}
          <div className="space-y-2 rounded-md border border-border p-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs">API Key</Label>
              <Button
                type="button"
                variant={confirmRegenerate ? "destructive" : "outline"}
                size="sm"
                className="h-7 gap-1.5 px-2 text-xs"
                onClick={handleRegenerate}
                disabled={isRegeneratingKey}
              >
                <RefreshCw className="h-3 w-3" />
                {confirmRegenerate
                  ? "Confirm regenerate?"
                  : isRegeneratingKey
                    ? "Regenerating..."
                    : "Regenerate Key"}
              </Button>
            </div>

            {confirmRegenerate && !regeneratedKey && (
              <div className="flex items-start gap-2 rounded-md bg-accent-amber/10 px-2.5 py-2">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent-amber" />
                <p className="text-[11px] text-accent-amber">
                  The old key will stop working immediately. Click again to
                  confirm.
                </p>
              </div>
            )}

            {regeneratedKey && (
              <div className="space-y-1.5">
                <div className="flex items-start gap-2 rounded-md bg-accent-amber/10 px-2.5 py-2">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent-amber" />
                  <p className="text-[11px] text-accent-amber">
                    Save this key now. It won't be shown again.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 overflow-hidden truncate rounded border border-border bg-surface-sunken px-2 py-1 font-mono text-[11px] text-foreground">
                    {regeneratedKey}
                  </code>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    onClick={handleCopyKey}
                  >
                    {copiedKey ? (
                      <Check className="h-3 w-3 text-accent-green" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </Button>
                </div>
              </div>
            )}
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
