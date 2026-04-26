import { useMemo, useState } from "react";
import { Copy, Check, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { useTerminals } from "@/hooks/use-terminal";
import { useTriggers } from "@/hooks/use-triggers";
import { useCopyWithFeedback } from "@/hooks/use-copy";
import { getApiBaseUrl } from "@/lib/config";
import { buildMcpConfig } from "@/lib/build-mcp-config";
import { useSetupAgentStore } from "@/stores/setup-agent-store";
import { logWizardEvent } from "@/lib/wizard-telemetry";
import { useCanvasImperativesStore } from "@/stores/canvas-imperatives-store";
import { starterPromptFor } from "../recipes/prompts";

export function StepCheckpoint() {
  const artifacts = useSetupAgentStore((s) => s.artifacts);
  const identity = useSetupAgentStore((s) => s.identity);
  const closeWizard = useSetupAgentStore((s) => s.closeWizard);
  const { terminals } = useTerminals();
  const { triggers } = useTriggers();
  const { copy, isCopied } = useCopyWithFeedback();

  const [revealed, setRevealed] = useState(false);

  const baseUrl = useMemo(() => getApiBaseUrl(), []);

  const workerTrigger = triggers.find((t) => t.id === artifacts.workerTriggerId);
  const shellTrigger = triggers.find((t) => t.id === artifacts.shellTriggerId);
  const workerReadToken =
    terminals.find((t) => t.id === artifacts.workerTerminalId)?.readToken ??
    artifacts.workerReadToken ??
    "";
  const shellReadToken =
    terminals.find((t) => t.id === artifacts.shellTerminalId)?.readToken ??
    artifacts.shellReadToken ??
    "";

  const mcpJson = useMemo(
    () =>
      buildMcpConfig({
        baseUrl,
        terminals: [
          artifacts.workerTerminalId
            ? {
                id: artifacts.workerTerminalId,
                name: identity.workerName,
                readToken: workerReadToken,
              }
            : null,
          artifacts.shellTerminalId
            ? {
                id: artifacts.shellTerminalId,
                name: identity.shellName,
                readToken: shellReadToken,
              }
            : null,
        ].filter((x): x is NonNullable<typeof x> => x !== null),
        triggers: [
          workerTrigger
            ? {
                id: workerTrigger.id,
                name: identity.workerName,
                trigger: workerTrigger,
              }
            : null,
          shellTrigger
            ? {
                id: shellTrigger.id,
                name: identity.shellName,
                trigger: shellTrigger,
              }
            : null,
        ].filter((x): x is NonNullable<typeof x> => x !== null),
        mask: !revealed,
      }),
    [
      baseUrl,
      revealed,
      identity.workerName,
      identity.shellName,
      artifacts.workerTerminalId,
      artifacts.shellTerminalId,
      workerReadToken,
      shellReadToken,
      workerTrigger,
      shellTrigger,
    ],
  );

  const starterPrompt = useMemo(
    () => starterPromptFor(identity.workerCli, identity),
    [identity],
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

  function handleDone() {
    logWizardEvent("done_clicked", {});
    const ids = [artifacts.workerNodeId, artifacts.shellNodeId].filter(
      (x): x is string => Boolean(x),
    );
    const fitNodes = useCanvasImperativesStore.getState().fitNodes;
    if (fitNodes && ids.length > 0) {
      fitNodes({ nodeIds: ids, padding: 0.2, maxZoom: 0.85, duration: 700 });
    }
    closeWizard();
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <span className="font-mono text-caption uppercase tracking-[0.18em] text-accent-amber">
          ◆ checkpoint reached
        </span>
        <h2 className="mt-2 text-h1 font-semibold tracking-tight">
          Your supervisor is ready.
        </h2>
        <p className="mt-1 text-body-sm text-muted-foreground">
          Save the config below to the supervisor machine, paste the starter prompt into your MCP client, and you&apos;re running.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* mcp.json card */}
        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="font-mono text-caption uppercase tracking-[0.18em] text-white/40">
              ~/.excaliterm/mcp.json
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
                onClick={() => {
                  copy(mcpJson, "mcp").catch(() => {});
                  toast.success("Config copied", {
                    description: "Paste into ~/.excaliterm/mcp.json on the supervisor machine.",
                  });
                }}
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
          <pre className="max-h-[260px] overflow-auto rounded-md border border-white/10 bg-surface-sunken px-3 py-2 font-mono text-caption leading-relaxed text-foreground/85">
            {mcpJson}
          </pre>
        </section>

        {/* Starter prompt card */}
        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="font-mono text-caption uppercase tracking-[0.18em] text-white/40">
              starter system prompt — for {identity.workerCli}
            </span>
            <button
              onClick={() => {
                copy(starterPrompt, "prompt").catch(() => {});
                toast.success("Prompt copied", {
                  description: "Paste as the supervisor's first message or system prompt.",
                });
              }}
              className="flex h-6 w-6 items-center justify-center rounded text-white/40 hover:bg-white/[0.08] hover:text-white/85"
              title="Copy"
            >
              {isCopied("prompt") ? (
                <Check className="h-3 w-3 text-accent-green" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
            </button>
          </div>
          <pre className="max-h-[260px] overflow-auto whitespace-pre-wrap rounded-md border border-white/10 bg-surface-sunken px-3 py-2 font-mono text-caption leading-relaxed text-foreground/85">
            {starterPrompt}
          </pre>
        </section>
      </div>

      {/* Client snippet */}
      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="font-mono text-caption uppercase tracking-[0.18em] text-white/40">
            add to your MCP client
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
      </section>

      <div className="flex justify-end">
        <button
          onClick={handleDone}
          className="rounded-md border border-accent-amber/40 bg-accent-amber/15 px-4 py-2 font-mono text-body-sm text-accent-amber hover:bg-accent-amber/20"
        >
          Done — show me the canvas
        </button>
      </div>
    </div>
  );
}
