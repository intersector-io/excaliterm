import { useState } from "react";
import { Copy, Check } from "lucide-react";
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

interface RegisterServiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRegister: (name: string) => Promise<{ service: ServiceInstance }>;
  isRegistering: boolean;
  workspaceId: string;
}

export function RegisterServiceDialog({
  open,
  onOpenChange,
  onRegister,
  isRegistering,
  workspaceId,
}: RegisterServiceDialogProps) {
  const [name, setName] = useState("");
  const [createdService, setCreatedService] = useState<ServiceInstance | null>(null);
  const [copiedConfig, setCopiedConfig] = useState(false);

  function handleClose(open: boolean) {
    if (!open) {
      setName("");
      setCreatedService(null);
      setCopiedConfig(false);
    }
    onOpenChange(open);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    const result = await onRegister(name.trim());
    setCreatedService(result.service);
  }

  function getConfigSnippet(): string {
    if (!createdService) return "";
    return [
      `SIGNALR_HUB_URL=${window.location.origin}`,
      "SERVICE_API_KEY=<same value configured on the SignalR hub>",
      `SERVICE_ID=${createdService.serviceId}`,
      `WORKSPACE_ID=${workspaceId}`,
    ].join("\n");
  }

  async function handleCopyConfig() {
    await copyToClipboard(getConfigSnippet());
    setCopiedConfig(true);
    setTimeout(() => setCopiedConfig(false), 2000);
  }

  // After creation: show setup instructions
  if (createdService) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Service Registered</DialogTitle>
            <DialogDescription>
              "{createdService.name}" has been registered successfully.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-md border border-border bg-surface-sunken px-3 py-2.5">
              <p className="text-xs text-muted-foreground">
                The terminal agent must use the same `SERVICE_API_KEY` configured on
                the SignalR hub deployment.
              </p>
            </div>

            {/* Config snippet */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">.env</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 gap-1 px-2 text-caption"
                  onClick={handleCopyConfig}
                >
                  {copiedConfig ? (
                    <>
                      <Check className="h-3 w-3 text-accent-green" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      Copy config
                    </>
                  )}
                </Button>
              </div>
              <pre className="max-h-48 overflow-auto rounded border border-border bg-surface-sunken p-3 font-mono text-caption leading-relaxed text-foreground">
                {getConfigSnippet()}
              </pre>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => handleClose(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // Registration form
  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Register Service</DialogTitle>
          <DialogDescription>
            Register a new terminal agent instance to manage terminals and files.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="service-name">Service Name</Label>
            <Input
              id="service-name"
              placeholder="e.g. Production Server 1"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              required
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleClose(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || isRegistering}>
              {isRegistering ? "Registering..." : "Register"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
