import { memo, useCallback, useEffect, useState } from "react";
import { Handle, Position } from "@xyflow/react";
import { Webhook, MoreHorizontal, Trash2, Eye, EyeOff, Copy, RotateCw } from "lucide-react";
import { toast } from "sonner";
import { useTriggers, onTriggerFired } from "@/hooks/use-triggers";
import { useTerminalCollaboration } from "@/hooks/use-terminal-collaboration";
import { copyToClipboard } from "@/lib/clipboard";
import { getApiBaseUrl } from "@/lib/config";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import type { Trigger, HttpTriggerConfig } from "@excaliterm/shared-types";

interface Props {
  trigger: Trigger;
  selected: boolean;
}

function formatRelative(iso: string | null): string {
  if (!iso) return "—";
  const diffSec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diffSec < 5) return "just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  const m = Math.floor(diffSec / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(iso).toLocaleString();
}

function HttpTriggerBodyComponent({ trigger, selected }: Props) {
  const config = trigger.config as HttpTriggerConfig;
  const { updateTrigger, deleteTrigger, rotateTrigger } = useTriggers();
  const { lockedByOther } = useTerminalCollaboration(trigger.terminalSessionId);

  const [revealToken, setRevealToken] = useState(false);
  const [fired, setFired] = useState(false);
  const [, forceTick] = useState(0);

  useEffect(() => {
    return onTriggerFired((evt) => {
      if (evt.triggerId !== trigger.id) return;
      setFired(true);
      window.setTimeout(() => setFired(false), 700);
    });
  }, [trigger.id]);

  useEffect(() => {
    if (!trigger.lastFiredAt) return;
    const id = window.setInterval(() => forceTick((n) => n + 1), 30_000);
    return () => window.clearInterval(id);
  }, [trigger.lastFiredAt]);

  const endpointUrl = `${getApiBaseUrl()}/api/triggers/${trigger.id}/fire`;
  const curlExample = `curl -X POST '${endpointUrl}' \\\n  -H 'X-Trigger-Token: ${config.secret}' \\\n  -H 'Content-Type: application/json' \\\n  -d '{"prompt":"echo hello"}'`;

  const enabled = trigger.enabled;
  const readOnly = lockedByOther;

  const toggleEnabled = useCallback(async () => {
    try {
      await updateTrigger({ id: trigger.id, data: { enabled: !enabled } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update");
    }
  }, [trigger.id, enabled, updateTrigger]);

  const handleDelete = useCallback(async () => {
    try {
      await deleteTrigger(trigger.id);
    } catch {
      toast.error("Failed to delete trigger");
    }
  }, [trigger.id, deleteTrigger]);

  const handleRotate = useCallback(async () => {
    await rotateTrigger(trigger.id);
    toast.success("Secret rotated", { description: "Old token will no longer work." });
  }, [trigger.id, rotateTrigger]);

  const copy = useCallback(async (text: string, label: string) => {
    try {
      await copyToClipboard(text);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Copy failed");
    }
  }, []);

  const dotClass = enabled
    ? "bg-accent-amber shadow-[0_0_8px_rgba(251,191,36,0.6)]"
    : "bg-white/30";

  const maskedToken = "•".repeat(Math.min(36, config.secret.length));

  return (
    <div className="h-full w-full">
      <Handle type="target" position={Position.Top} className="!w-1.5 !h-1.5 !bg-amber-400/40 !border-0 !rounded-sm" />
      <div
        className={`flex h-full w-full flex-col overflow-hidden rounded-xl border border-amber-400/20 bg-card transition-all ${
          enabled ? "trigger-active" : ""
        } ${fired ? "trigger-fired" : ""} ${selected ? "ring-1 ring-amber-400/40" : ""}`}
      >
        <div className="drag-handle flex items-center justify-between border-b border-amber-400/15 px-3 min-h-[36px] py-1.5">
          <div className="flex min-w-0 items-center gap-2">
            <Webhook className="h-3.5 w-3.5 text-accent-amber/80" />
            <span className="font-sans text-caption font-semibold uppercase tracking-[0.18em] text-accent-amber/90">
              HTTP
            </span>
            <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="nodrag nopan flex h-6 w-6 items-center justify-center rounded-md text-white/40 transition-colors hover:bg-white/[0.08] hover:text-white/70"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => copy(endpointUrl, "Endpoint")}>
                <Copy className="h-3.5 w-3.5" />
                <span>Copy endpoint</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => copy(curlExample, "cURL")}>
                <Copy className="h-3.5 w-3.5" />
                <span>Copy cURL</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleRotate} disabled={readOnly}>
                <RotateCw className="h-3.5 w-3.5" />
                <span>Rotate secret</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleDelete}
                disabled={readOnly}
                className="text-accent-red focus:text-accent-red"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Delete trigger</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="nodrag nopan flex flex-1 flex-col gap-2 px-3 py-2.5">
          {/* Endpoint row */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="text-caption uppercase tracking-wide text-white/40">endpoint</span>
              <button
                onClick={() => copy(endpointUrl, "Endpoint")}
                title="Copy endpoint"
                className="flex h-5 w-5 items-center justify-center rounded text-white/35 hover:bg-white/[0.08] hover:text-white/85"
              >
                <Copy className="h-3 w-3" />
              </button>
            </div>
            <div className="truncate rounded-md border border-white/10 bg-surface-sunken px-2 py-1 font-mono text-caption text-foreground/85" title={endpointUrl}>
              {endpointUrl}
            </div>
          </div>

          {/* Token row */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="text-caption uppercase tracking-wide text-white/40">token</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setRevealToken((v) => !v)}
                  title={revealToken ? "Hide" : "Reveal"}
                  className="flex h-5 w-5 items-center justify-center rounded text-white/35 hover:bg-white/[0.08] hover:text-white/85"
                >
                  {revealToken ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                </button>
                <button
                  onClick={() => copy(config.secret, "Token")}
                  title="Copy token"
                  className="flex h-5 w-5 items-center justify-center rounded text-white/35 hover:bg-white/[0.08] hover:text-white/85"
                >
                  <Copy className="h-3 w-3" />
                </button>
                <button
                  onClick={handleRotate}
                  disabled={readOnly}
                  title="Rotate secret"
                  className="flex h-5 w-5 items-center justify-center rounded text-white/35 hover:bg-white/[0.08] hover:text-white/85 disabled:opacity-30"
                >
                  <RotateCw className="h-3 w-3" />
                </button>
              </div>
            </div>
            <div className="truncate rounded-md border border-white/10 bg-surface-sunken px-2 py-1 font-mono text-caption text-foreground/85">
              {revealToken ? config.secret : maskedToken}
            </div>
          </div>

          {/* Footer: enable toggle + last invoked */}
          <div className="mt-auto flex items-center justify-between pt-0.5">
            <button
              onClick={toggleEnabled}
              disabled={readOnly}
              className={`flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-caption font-semibold transition-colors ${
                enabled
                  ? "border-amber-400/30 bg-amber-400/15 text-accent-amber hover:bg-amber-400/20"
                  : "border-white/10 bg-white/[0.03] text-white/50 hover:bg-white/[0.08]"
              } disabled:opacity-50`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${enabled ? "bg-accent-amber" : "bg-white/40"}`} />
              {enabled ? "active" : "paused"}
            </button>
            <span className="font-mono text-caption text-white/40">
              last {formatRelative(trigger.lastFiredAt)}
            </span>
          </div>

          {trigger.lastError && (
            <div className="rounded-md border border-accent-red/30 bg-accent-red/10 px-2 py-1 text-caption text-accent-red/90">
              {trigger.lastError}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export const HttpTriggerBody = memo(HttpTriggerBodyComponent);
