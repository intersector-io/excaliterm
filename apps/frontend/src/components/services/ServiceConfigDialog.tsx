import { useState } from "react";
import { Terminal } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { buildRunCommand, buildEnvFile } from "@/lib/excaliterm-commands";
import { useCopyWithFeedback } from "@/hooks/use-copy";
import type { ServiceInstance } from "@/lib/api-client";

function getDeleteButtonLabel(confirmDelete: boolean, isDeleting: boolean): string {
  if (!confirmDelete) return "Delete this service";
  if (isDeleting) return "Deleting...";
  return "Click again to confirm deletion";
}

interface ServiceConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  service: ServiceInstance;
  workspaceId: string;
  apiKey: string;
  onDelete: () => Promise<unknown>;
  isDeleting: boolean;
}

export function ServiceConfigDialog({
  open,
  onOpenChange,
  service,
  workspaceId,
  apiKey,
  onDelete,
  isDeleting,
}: ServiceConfigDialogProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { copy, isCopied, reset } = useCopyWithFeedback();

  function handleClose(value: boolean) {
    if (!value) {
      setConfirmDelete(false);
      reset();
    }
    onOpenChange(value);
  }

  async function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    await onDelete();
    handleClose(false);
  }

  const hubUrl = window.location.origin;
  const params = { hubUrl, workspaceId, apiKey, serviceId: service.serviceId };
  const runCmd = buildRunCommand(params);
  const envFile = buildEnvFile(params);

  const isOnline = service.status === "online";

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Service Details</DialogTitle>
          <DialogDescription>
            Connection details for "{service.name}".
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Service info */}
          <div className="space-y-2 rounded-md border border-border bg-surface-sunken px-3 py-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Status</span>
              <span className={`text-xs font-medium ${isOnline ? "text-accent-green" : "text-muted-foreground"}`}>
                {isOnline ? "Online" : "Offline"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Service ID</span>
              <span className="max-w-[180px] truncate font-mono text-caption text-foreground">
                {service.serviceId}
              </span>
            </div>
            {service.lastSeen && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Last seen</span>
                <span className="text-caption text-foreground">
                  {new Date(service.lastSeen).toLocaleString()}
                </span>
              </div>
            )}
          </div>

          {/* Run command */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                Run command
              </span>
              <CopyButton
                copied={isCopied("command")}
                onClick={() => copy(runCmd, "command")}
              />
            </div>
            <pre className="overflow-x-auto rounded border border-border bg-surface-sunken p-3 font-mono text-caption leading-relaxed text-foreground">
              {runCmd}
            </pre>
          </div>

          {/* Alternative: .env */}
          <details className="group">
            <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
              Or use environment variables / .env file
            </summary>
            <div className="mt-2 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  .env
                </span>
                <CopyButton
                  copied={isCopied("env")}
                  onClick={() => copy(envFile, "env")}
                />
              </div>
              <pre className="overflow-x-auto rounded border border-border bg-surface-sunken p-3 font-mono text-caption leading-relaxed text-foreground">
                {envFile}
              </pre>
            </div>
          </details>

          {/* Hint */}
          <div className="flex items-start gap-2 rounded-md border border-border bg-surface-sunken px-3 py-2.5">
            <Terminal className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <p className="text-caption leading-relaxed text-muted-foreground">
              Use the same <code className="rounded bg-surface-sunken px-1">--service-id</code> to
              reconnect this service after a restart.
            </p>
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button
            className="w-full"
            onClick={() => handleClose(false)}
          >
            Done
          </Button>
          <Button
            type="button"
            variant={confirmDelete ? "destructive" : "ghost"}
            size="sm"
            className="w-full gap-1.5 text-xs text-destructive hover:text-destructive"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {getDeleteButtonLabel(confirmDelete, isDeleting)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
