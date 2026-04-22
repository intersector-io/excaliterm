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
}: RegisterServiceDialogProps) {
  const [copiedInstall, setCopiedInstall] = useState(false);
  const [copiedCommand, setCopiedCommand] = useState(false);
  const [copiedEnv, setCopiedEnv] = useState(false);

  function handleClose(value: boolean) {
    if (!value) {
      setCopiedInstall(false);
      setCopiedCommand(false);
      setCopiedEnv(false);
    }
    onOpenChange(value);
  }

  const hubUrl = window.location.origin;

  const installCmd = "npm install -g excaliterm";

  const inlineCmd = [
    "excaliterm \\",
    `  --hub-url ${hubUrl} \\`,
    `  --workspace-id ${workspaceId} \\`,
    `  --api-key ${apiKey}`,
  ].join("\n");

  const envFileContent = [
    `SIGNALR_HUB_URL=${hubUrl}`,
    `WORKSPACE_ID=${workspaceId}`,
    `SERVICE_API_KEY=${apiKey}`,
  ].join("\n");

  async function handleCopy(
    text: string,
    setter: (v: boolean) => void,
  ) {
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
                copied={copiedInstall}
                onClick={() => handleCopy(installCmd, setCopiedInstall)}
              />
            </div>
            <pre className="overflow-x-auto rounded border border-border bg-surface-sunken p-3 font-mono text-caption leading-relaxed text-foreground">
              {installCmd}
            </pre>
          </div>

          {/* Step 2: Run */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                2. Run the agent
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
