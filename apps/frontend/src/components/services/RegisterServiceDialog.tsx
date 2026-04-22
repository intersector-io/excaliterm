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
import { INSTALL_CMD, buildRunCommand, buildEnvFile } from "@/lib/excaliterm-commands";
import { useCopyWithFeedback } from "@/hooks/use-copy";

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

  function handleClose(value: boolean) {
    if (!value) reset();
    onOpenChange(value);
  }

  const hubUrl = globalThis.location.origin;
  const params = { hubUrl, workspaceId, apiKey };
  const runCmd = buildRunCommand(params);
  const envFile = buildEnvFile(params);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Connect a Host</DialogTitle>
          <DialogDescription>
            Install the Excaliterm agent on the machine you want to connect, then
            run it with your workspace credentials.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
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
