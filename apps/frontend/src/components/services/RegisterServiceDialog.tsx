import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { KeyRound, Sparkles, Terminal } from "lucide-react";
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
import { INSTALL_CMD, buildRunCommand, buildEnvFile } from "@/lib/excaliterm-commands";
import { getHubUrl } from "@/lib/config";
import { useCopyWithFeedback } from "@/hooks/use-copy";
import { createWorkspace } from "@/lib/api-client";
import { WORKSPACE_STORAGE_KEY, workspaceApiKeyStorageKey } from "@/lib/utils";

interface RegisterServiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  apiKey: string;
}

export function RegisterServiceDialog({
  open,
  onOpenChange,
  workspaceId,
  apiKey,
}: Readonly<RegisterServiceDialogProps>) {
  const { copy, isCopied, reset } = useCopyWithFeedback();
  const [, navigate] = useLocation();
  const [creating, setCreating] = useState(false);

  function handleClose(value: boolean) {
    if (!value) reset();
    onOpenChange(value);
  }

  async function handleCreateWorkspace() {
    setCreating(true);
    try {
      const ws = await createWorkspace();
      globalThis.localStorage.setItem(WORKSPACE_STORAGE_KEY, ws.id);
      globalThis.localStorage.setItem(workspaceApiKeyStorageKey(ws.id), ws.apiKey);
      onOpenChange(false);
      navigate(`/w/${ws.id}`, { replace: true });
    } catch {
      toast.error("Failed to create workspace");
      setCreating(false);
    }
  }

  const hubUrl = getHubUrl();
  const params = { hubUrl, workspaceId, apiKey };
  const runCmd = buildRunCommand(params);
  const envFile = buildEnvFile(params);

  if (!apiKey) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Connect a Host</DialogTitle>
            <DialogDescription>
              Install the Excaliterm agent on the machine you want to connect,
              then run it with your workspace credentials.
            </DialogDescription>
          </DialogHeader>

          <div className="min-w-0 space-y-4">
            <div className="flex items-start gap-3 rounded-md border border-accent-amber/20 bg-accent-amber/[0.06] px-4 py-3">
              <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-accent-amber" />
              <div className="space-y-1">
                <p className="text-body-sm font-medium text-foreground">
                  API key unavailable on this browser
                </p>
                <p className="text-caption leading-relaxed text-muted-foreground">
                  The workspace API key is shown only once — at creation — and
                  stored in the browser that created it. It can't be recovered
                  from a shared link or a different browser, by design.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-body-sm font-medium text-foreground">
                What you can do
              </p>
              <ul className="space-y-1.5 text-caption leading-relaxed text-muted-foreground">
                <li className="flex gap-2">
                  <span className="text-muted-foreground/50">•</span>
                  <span>
                    Open this workspace in the original browser that created
                    it, then retry connecting a host there.
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="text-muted-foreground/50">•</span>
                  <span>
                    Or create a fresh workspace — you'll get a new shareable
                    link and a new API key.
                  </span>
                </li>
              </ul>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="secondary" onClick={() => handleClose(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateWorkspace}
              disabled={creating}
              className="gap-2"
            >
              <Sparkles className="h-4 w-4" />
              {creating ? "Creating..." : "Create new workspace"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Connect a Host</DialogTitle>
          <DialogDescription>
            Install the Excaliterm agent on the machine you want to connect, then
            run it with your workspace credentials.
          </DialogDescription>
        </DialogHeader>

        <div className="min-w-0 space-y-4">
          {/* Step 1: Install */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                1. Install the package
              </span>
              <CopyButton
                copied={isCopied("install")}
                onClick={() => copy(INSTALL_CMD, "install")}
              />
            </div>
            <pre className="overflow-x-auto rounded border border-border bg-surface-sunken p-3 font-mono text-caption leading-relaxed text-foreground">
              {INSTALL_CMD}
            </pre>
          </div>

          {/* Step 2: Run */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                2. Run the agent
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
              <p className="text-caption text-muted-foreground">
                Then run <code className="rounded bg-surface-sunken px-1">excaliterm</code> or{" "}
                <code className="rounded bg-surface-sunken px-1">npx excaliterm</code>
              </p>
            </div>
          </details>

          {/* Hint */}
          <div className="flex items-start gap-2 rounded-md border border-border bg-surface-sunken px-3 py-2.5">
            <Terminal className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <p className="text-caption leading-relaxed text-muted-foreground">
              The service will appear here automatically once the agent connects.
              Use <code className="rounded bg-surface-sunken px-1">--help</code>{" "}
              for all available options.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={() => handleClose(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
