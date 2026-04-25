import { useCallback, useState } from "react";
import { Copy, Check, Eye, EyeOff, RotateCw } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useTerminals } from "@/hooks/use-terminal";
import { useCopyWithFeedback } from "@/hooks/use-copy";

interface TerminalConnectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  terminalId: string;
  readToken: string;
  friendlyName?: string;
}

const MASKED = "•".repeat(36);

export function TerminalConnectionDialog({
  open,
  onOpenChange,
  terminalId,
  readToken,
  friendlyName,
}: Readonly<TerminalConnectionDialogProps>) {
  const { rotateReadToken } = useTerminals();
  const { copy, isCopied } = useCopyWithFeedback();
  const [revealed, setRevealed] = useState(false);
  const [rotating, setRotating] = useState(false);

  const handleCopy = useCallback(
    async (text: string, key: string, label: string) => {
      try {
        await copy(text, key);
        toast.success(`${label} copied`);
      } catch {
        toast.error("Couldn't copy — select and copy manually");
      }
    },
    [copy],
  );

  const handleRotate = useCallback(async () => {
    if (rotating) return;
    setRotating(true);
    try {
      await rotateReadToken(terminalId);
      toast.success("Read token rotated", {
        description: "The old token will no longer work.",
      });
    } catch {
      toast.error("Failed to rotate token");
    } finally {
      setRotating(false);
    }
  }, [rotating, rotateReadToken, terminalId]);

  const name = friendlyName ?? `terminal-${terminalId.slice(0, 8)}`;
  const jsonSnippet = `"${name}": { "id": "${terminalId}", "readToken": "${readToken}" }`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-md gap-4 p-5">
        <div>
          <DialogTitle className="text-body font-semibold tracking-tight">
            Connection details
          </DialogTitle>
          <DialogDescription className="text-caption text-muted-foreground">
            For wiring this terminal into <code className="font-mono">@excaliterm/mcp-tools</code>.
          </DialogDescription>
        </div>

        <Field
          label="terminal id"
          value={terminalId}
          mono
          rightSlot={
            <CopyButton
              copied={isCopied("id")}
              onClick={() => handleCopy(terminalId, "id", "Terminal ID")}
            />
          }
        />

        <Field
          label="read token"
          value={revealed ? readToken : MASKED}
          mono
          rightSlot={
            <div className="flex items-center gap-1">
              <IconButton
                title={revealed ? "Hide" : "Reveal"}
                onClick={() => setRevealed((v) => !v)}
              >
                {revealed ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
              </IconButton>
              <CopyButton
                copied={isCopied("token")}
                onClick={() => handleCopy(readToken, "token", "Token")}
              />
              <IconButton
                title="Rotate"
                onClick={handleRotate}
                disabled={rotating}
              >
                <RotateCw className={`h-3 w-3 ${rotating ? "animate-spin" : ""}`} />
              </IconButton>
            </div>
          }
        />

        <div className="flex flex-col gap-1.5">
          <span className="text-caption uppercase tracking-[0.18em] text-white/40">
            mcp.json snippet
          </span>
          <div className="relative rounded-md border border-white/10 bg-surface-sunken px-2.5 py-2 pr-10 font-mono text-caption leading-relaxed text-foreground/85 break-all">
            {jsonSnippet}
            <button
              type="button"
              onClick={() => handleCopy(jsonSnippet, "json", "Snippet")}
              className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded text-white/40 hover:bg-white/[0.08] hover:text-white/85"
            >
              {isCopied("json") ? (
                <Check className="h-3 w-3 text-accent-green" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
            </button>
          </div>
          <span className="text-caption text-muted-foreground">
            Paste under <code className="font-mono">terminals</code> in your <code className="font-mono">~/.excaliterm/mcp.json</code>.
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  value,
  mono,
  rightSlot,
}: {
  label: string;
  value: string;
  mono?: boolean;
  rightSlot?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-caption uppercase tracking-[0.18em] text-white/40">{label}</span>
        {rightSlot}
      </div>
      <div className={`truncate rounded-md border border-white/10 bg-surface-sunken px-2.5 py-1.5 ${mono ? "font-mono" : ""} text-body-sm text-foreground/85`}>
        {value}
      </div>
    </div>
  );
}

function IconButton({
  children,
  title,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  title: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className="flex h-6 w-6 items-center justify-center rounded text-white/40 hover:bg-white/[0.08] hover:text-white/85 disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function CopyButton({ copied, onClick }: { copied: boolean; onClick: () => void }) {
  return (
    <IconButton title={copied ? "Copied" : "Copy"} onClick={onClick}>
      {copied ? <Check className="h-3 w-3 text-accent-green" /> : <Copy className="h-3 w-3" />}
    </IconButton>
  );
}
