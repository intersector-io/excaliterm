import { useState } from "react";
import { Copy, Check, Terminal } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { copyToClipboard } from "@/lib/clipboard";
import type { ServiceInstance } from "@/lib/api-client";

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
  const [copiedCommand, setCopiedCommand] = useState(false);
  const [copiedEnv, setCopiedEnv] = useState(false);

  function handleClose(value: boolean) {
    if (!value) {
      setConfirmDelete(false);
      setCopiedCommand(false);
      setCopiedEnv(false);
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

  const inlineCmd = [
    "excaliterm \\",
    `  --hub-url ${hubUrl} \\`,
    `  --workspace-id ${workspaceId} \\`,
    `  --service-id ${service.serviceId} \\`,
    `  --api-key ${apiKey}`,
  ].join("\n");

  const envFileContent = [
    `SIGNALR_HUB_URL=${hubUrl}`,
    `WORKSPACE_ID=${workspaceId}`,
    `SERVICE_ID=${service.serviceId}`,
    `SERVICE_API_KEY=${apiKey}`,
  ].join("\n");

  async function handleCopy(text: string, setter: (v: boolean) => void) {
    await copyToClipboard(text);
    setter(true);
    setTimeout(() => setter(false), 2000);
  }

  function CopyButton({
    copied,
    onClick,
  }: {
    copied: boolean;
    onClick: () => void;
  }) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="h-6 gap-1 px-2 text-caption"
        onClick={onClick}
      >
        {copied ? (
          <>
            <Check className="h-3 w-3 text-accent-green" />
            Copied
          </>
        ) : (
          <>
            <Copy className="h-3 w-3" />
            Copy
          </>
        )}
      </Button>
    );
  }

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
                copied={copiedCommand}
                onClick={() => handleCopy(inlineCmd, setCopiedCommand)}
              />
            </div>
            <pre className="overflow-x-auto rounded border border-border bg-surface-sunken p-3 font-mono text-caption leading-relaxed text-foreground">
              {inlineCmd}
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
                  copied={copiedEnv}
                  onClick={() => handleCopy(envFileContent, setCopiedEnv)}
                />
              </div>
              <pre className="overflow-x-auto rounded border border-border bg-surface-sunken p-3 font-mono text-caption leading-relaxed text-foreground">
                {envFileContent}
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
            {confirmDelete
              ? isDeleting
                ? "Deleting..."
                : "Click again to confirm deletion"
              : "Delete this service"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
