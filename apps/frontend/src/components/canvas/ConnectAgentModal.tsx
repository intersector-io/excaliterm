import { useEffect, useMemo, useRef, useState } from "react";
import { Copy, Check, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useTerminals } from "@/hooks/use-terminal";
import { useTriggers } from "@/hooks/use-triggers";
import { useCopyWithFeedback } from "@/hooks/use-copy";
import { getApiBaseUrl } from "@/lib/config";
import { buildMcpConfig } from "@/lib/build-mcp-config";
import { sanitizeIdentifier } from "@/lib/utils";
import type { Trigger } from "@excaliterm/shared-types";

interface ConnectAgentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DOCS_URL =
  "https://github.com/intersector-io/excaliterm/blob/main/docs/features/triggers.user.md";
const INSTALL_CMD = "npm install -g @excaliterm/mcp-tools";

interface TerminalSelection {
  id: string;
  name: string;
  selected: boolean;
}

interface TriggerSelection {
  id: string;
  name: string;
  trigger: Trigger;
  selected: boolean;
}

function defaultTerminalName(id: string): string {
  return `terminal_${id.slice(0, 8)}`;
}

function defaultTriggerName(t: Trigger): string {
  return `trigger_${t.terminalSessionId.slice(0, 8)}`;
}

export function ConnectAgentModal({ open, onOpenChange }: Readonly<ConnectAgentModalProps>) {
  const { terminals } = useTerminals();
  const { triggers } = useTriggers();
  const { copy, isCopied } = useCopyWithFeedback();

  const [terminalSel, setTerminalSel] = useState<TerminalSelection[]>([]);
  const [triggerSel, setTriggerSel] = useState<TriggerSelection[]>([]);
  const [revealed, setRevealed] = useState(false);
  const [rippling, setRippling] = useState(false);

  // Sync local selection state with the workspace's terminals/triggers when
  // the modal opens. Keeps existing selections if the same item still exists.
  useEffect(() => {
    if (!open) return;
    setTerminalSel((prev) => {
      const byId = new Map(prev.map((t) => [t.id, t]));
      return terminals
        .filter((t) => t.status === "active" && t.readToken)
        .map((t) => ({
          id: t.id,
          name: byId.get(t.id)?.name ?? defaultTerminalName(t.id),
          selected: byId.get(t.id)?.selected ?? true,
        }));
    });
    setTriggerSel((prev) => {
      const byId = new Map(prev.map((t) => [t.id, t]));
      return triggers
        .filter((t) => t.type === "http" && t.enabled)
        .map((t) => ({
          id: t.id,
          name: byId.get(t.id)?.name ?? defaultTriggerName(t),
          trigger: t,
          selected: byId.get(t.id)?.selected ?? true,
        }));
    });
  }, [open, terminals, triggers]);

  const baseUrl = useMemo(() => getApiBaseUrl(), []);

  const buildConfig = (mask: boolean): string =>
    buildMcpConfig({
      baseUrl,
      terminals: terminalSel
        .filter((x) => x.selected)
        .map((t) => ({
          id: t.id,
          name: t.name,
          readToken: terminals.find((lt) => lt.id === t.id)?.readToken ?? "",
        })),
      triggers: triggerSel
        .filter((x) => x.selected)
        .map((t) => ({ id: t.trigger.id, name: t.name, trigger: t.trigger })),
      mask,
    });

  const mcpJson = useMemo(
    () => buildConfig(!revealed),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [baseUrl, terminalSel, triggerSel, terminals, revealed],
  );

  const clientConfigJson = useMemo(
    () =>
      JSON.stringify(
        {
          mcpServers: {
            excaliterm: {
              command: "excaliterm-mcp",
              env: { EXCALITERM_CONFIG: "~/.excaliterm/mcp.json" },
            },
          },
        },
        null,
        2,
      ),
    [],
  );

  const rippleTimeoutRef = useRef<number | null>(null);
  useEffect(() => {
    return () => {
      if (rippleTimeoutRef.current !== null) {
        window.clearTimeout(rippleTimeoutRef.current);
      }
    };
  }, []);

  const onCopyConfig = async () => {
    try {
      await copy(buildConfig(false), "mcp");
      setRippling(true);
      if (rippleTimeoutRef.current !== null) {
        window.clearTimeout(rippleTimeoutRef.current);
      }
      rippleTimeoutRef.current = window.setTimeout(() => {
        setRippling(false);
        rippleTimeoutRef.current = null;
      }, 700);
      toast.success("Config copied", {
        description: "Paste into ~/.excaliterm/mcp.json",
      });
    } catch {
      toast.error("Couldn't copy — select and copy manually");
    }
  };

  const hasTerminals = terminalSel.length > 0;
  const hasTriggers = triggerSel.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-4xl gap-0 p-0 overflow-hidden">
        <div className="border-b border-border-subtle/60 px-5 py-3.5">
          <DialogTitle className="text-h3 font-semibold tracking-tight">
            Connect an agent
          </DialogTitle>
          <DialogDescription className="text-body-sm text-muted-foreground">
            Run Claude Code, Aider, or any MCP-aware client and let it read &amp; write any terminal in this workspace.
          </DialogDescription>
        </div>

        {/* Install banner */}
        <div className="border-b border-border-subtle/40 px-5 py-3 flex items-center gap-3">
          <span className="font-mono text-caption uppercase tracking-[0.18em] text-white/40">
            install
          </span>
          <code className="flex-1 truncate rounded-md border border-white/10 bg-surface-sunken px-2.5 py-1 font-mono text-caption text-foreground/85">
            $ {INSTALL_CMD}
          </code>
          <button
            onClick={() => {
              copy(INSTALL_CMD, "install").catch(() => {});
              toast.success("Command copied");
            }}
            className="flex h-7 w-7 items-center justify-center rounded-md text-white/40 hover:bg-white/[0.08] hover:text-white/85"
            title="Copy"
          >
            {isCopied("install") ? <Check className="h-3.5 w-3.5 text-accent-green" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
        </div>

        {/* Two-column body */}
        <div className="grid gap-0 md:grid-cols-2">
          {/* LEFT — pick what to expose */}
          <div className="flex flex-col gap-4 border-b border-border-subtle/40 p-5 md:border-b-0 md:border-r">
            <span className="text-caption uppercase tracking-[0.18em] text-white/40 font-mono">
              pick what to expose
            </span>

            {/* Terminals */}
            <div className="flex flex-col gap-2">
              <span className="text-caption uppercase tracking-[0.18em] text-white/55 font-mono">
                terminals
              </span>
              {!hasTerminals && (
                <EmptyHint>
                  No active terminals to expose. Connect a host first.
                </EmptyHint>
              )}
              <div className="flex flex-col gap-1">
                {terminalSel.map((t) => (
                  <SelectionRow
                    key={t.id}
                    checked={t.selected}
                    onToggle={() =>
                      setTerminalSel((prev) =>
                        prev.map((x) => (x.id === t.id ? { ...x, selected: !x.selected } : x)),
                      )
                    }
                    name={t.name}
                    onNameChange={(n) =>
                      setTerminalSel((prev) =>
                        prev.map((x) => (x.id === t.id ? { ...x, name: n } : x)),
                      )
                    }
                    idSlice={t.id.slice(0, 8)}
                    meta={
                      terminals.find((lt) => lt.id === t.id)?.tags?.[0] ?? "shell"
                    }
                  />
                ))}
              </div>
            </div>

            {/* Triggers */}
            <div className="flex flex-col gap-2">
              <span className="text-caption uppercase tracking-[0.18em] text-white/55 font-mono">
                triggers
              </span>
              {!hasTriggers && (
                <EmptyHint>
                  No active HTTP triggers — your agent can read but not send commands. Add one from a terminal&apos;s ⋯ menu.
                </EmptyHint>
              )}
              <div className="flex flex-col gap-1">
                {triggerSel.map((t) => (
                  <SelectionRow
                    key={t.id}
                    checked={t.selected}
                    onToggle={() =>
                      setTriggerSel((prev) =>
                        prev.map((x) => (x.id === t.id ? { ...x, selected: !x.selected } : x)),
                      )
                    }
                    name={t.name}
                    onNameChange={(n) =>
                      setTriggerSel((prev) =>
                        prev.map((x) => (x.id === t.id ? { ...x, name: n } : x)),
                      )
                    }
                    idSlice={t.id.slice(0, 8)}
                    meta="active"
                  />
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT — generated config + client snippet */}
          <div className="flex flex-col gap-4 p-5">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-caption uppercase tracking-[0.18em] text-white/40 font-mono">
                  generated config — ~/.excaliterm/mcp.json
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setRevealed((v) => !v)}
                    className="flex h-6 w-6 items-center justify-center rounded text-white/40 hover:bg-white/[0.08] hover:text-white/85"
                    title={revealed ? "Hide tokens" : "Reveal tokens"}
                  >
                    {revealed ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                  </button>
                  <button
                    onClick={onCopyConfig}
                    className="flex h-6 w-6 items-center justify-center rounded text-white/40 hover:bg-white/[0.08] hover:text-white/85"
                    title="Copy"
                  >
                    {isCopied("mcp") ? (
                      <Check className="h-3 w-3 text-accent-green" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </button>
                </div>
              </div>
              <pre
                className={`max-h-[280px] overflow-auto rounded-md border border-white/10 bg-surface-sunken px-3 py-2 font-mono text-caption leading-relaxed text-foreground/85 ${
                  rippling ? "trigger-fired" : ""
                }`}
              >
                {mcpJson}
              </pre>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-caption uppercase tracking-[0.18em] text-white/40 font-mono">
                  add to your client
                </span>
                <button
                  onClick={() => {
                    copy(clientConfigJson, "client").catch(() => {});
                    toast.success("Client config copied");
                  }}
                  className="flex h-6 w-6 items-center justify-center rounded text-white/40 hover:bg-white/[0.08] hover:text-white/85"
                  title="Copy"
                >
                  {isCopied("client") ? (
                    <Check className="h-3 w-3 text-accent-green" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </button>
              </div>
              <pre className="overflow-auto rounded-md border border-white/10 bg-surface-sunken px-3 py-2 font-mono text-caption leading-relaxed text-foreground/85">
                {clientConfigJson}
              </pre>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border-subtle/60 px-5 py-3">
          <a
            href={DOCS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-body-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Open docs ↗
          </a>
          <button
            onClick={() => onOpenChange(false)}
            className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-1.5 text-body-sm text-white/85 hover:bg-white/[0.08] hover:text-foreground"
          >
            Done
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SelectionRow({
  checked,
  onToggle,
  name,
  onNameChange,
  idSlice,
  meta,
}: {
  checked: boolean;
  onToggle: () => void;
  name: string;
  onNameChange: (next: string) => void;
  idSlice: string;
  meta?: string;
}) {
  return (
    <label className="flex items-center gap-2 rounded-md border border-transparent px-1.5 py-1 hover:border-white/[0.08] hover:bg-white/[0.02]">
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        className="h-3.5 w-3.5 cursor-pointer accent-amber-400"
      />
      <input
        type="text"
        value={name}
        onChange={(e) => onNameChange(sanitizeIdentifier(e.target.value))}
        spellCheck={false}
        className="flex-1 bg-transparent font-mono text-body-sm font-semibold text-foreground/90 outline-none focus:bg-white/[0.04] rounded px-1"
      />
      <span className="font-mono text-caption text-muted-foreground/70">{idSlice}</span>
      {meta && (
        <span className="text-caption text-muted-foreground">{meta}</span>
      )}
    </label>
  );
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-dashed border-white/10 bg-white/[0.02] px-3 py-2 text-caption text-muted-foreground">
      {children}
    </div>
  );
}
