import { useCallback, useEffect, useRef, useState } from "react";
import { Server, Terminal, FileCode, Plus, X, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useServices } from "@/hooks/use-services";
import { useTerminals } from "@/hooks/use-terminal";
import { useWorkspace } from "@/hooks/use-workspace";
import { useCreateWorkspace } from "@/hooks/use-create-workspace";
import { EditorFullScreen } from "@/components/editor/EditorFullScreen";
import { INSTALL_CMD, buildRunCommand, buildEnvFile } from "@/lib/excaliterm-commands";
import { getHubUrl } from "@/lib/config";
import { useCopyWithFeedback } from "@/hooks/use-copy";
import { CopyButton } from "@/components/ui/copy-button";
import { Button } from "@/components/ui/button";
import { MissingApiKeyExplainer } from "@/components/workspace/MissingApiKeyExplainer";
import {
  findNewHostServiceId,
  getHostServiceIds,
} from "@/lib/host-services";
import type { ServiceInstance } from "@/lib/api-client";

interface MobileHostsSectionProps {
  onTerminalCreated?: () => void;
}

export function MobileHostsSection({ onTerminalCreated }: Readonly<MobileHostsSectionProps>) {
  const { services, deleteService, isLoading } = useServices();
  const { createTerminal, isCreating } = useTerminals();
  const { workspaceId, apiKey } = useWorkspace();
  const [editorServiceId, setEditorServiceId] = useState<string | null>(null);
  const [highlightedServiceId, setHighlightedServiceId] = useState<string | null>(
    null,
  );
  const sectionRef = useRef<HTMLDivElement>(null);
  const hasInitializedServicesRef = useRef(false);
  const previousServiceIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!hasInitializedServicesRef.current) {
      if (isLoading) return;
      previousServiceIdsRef.current = getHostServiceIds(services);
      hasInitializedServicesRef.current = true;
      return;
    }

    const previousServiceIds = previousServiceIdsRef.current;
    const newHostServiceId = findNewHostServiceId(services, previousServiceIds);
    const shouldRevealNewHost =
      previousServiceIds.size === 0 && services.length > 0 && newHostServiceId;

    previousServiceIdsRef.current = getHostServiceIds(services);

    if (!shouldRevealNewHost) return;

    sectionRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
    setHighlightedServiceId(newHostServiceId);

    const timeout = globalThis.setTimeout(() => {
      setHighlightedServiceId((current) =>
        current === newHostServiceId ? null : current,
      );
    }, 2500);

    return () => globalThis.clearTimeout(timeout);
  }, [services, isLoading]);

  const handleNewTerminal = useCallback(
    async (service: ServiceInstance) => {
      if (service.status !== "online") return;
      try {
        await createTerminal({ serviceInstanceId: service.id });
        toast.success("Terminal created");
        onTerminalCreated?.();
      } catch {
        toast.error("Failed to create terminal");
      }
    },
    [createTerminal, onTerminalCreated],
  );

  if (!apiKey) {
    return <MissingApiKeyRecovery />;
  }

  if (services.length === 0) {
    return <ConnectHostInline workspaceId={workspaceId} apiKey={apiKey} />;
  }

  return (
    <>
      <div ref={sectionRef} className="space-y-1.5">
        <h3 className="flex items-center gap-1.5 px-1 text-caption font-medium uppercase tracking-wider text-muted-foreground/60">
          <span>Hosts</span>
          <span className="text-muted-foreground/30">{services.length}</span>
        </h3>
        {services.map((service) => {
          const isOnline = service.status === "online";
          const isHighlighted = service.id === highlightedServiceId;
          return (
            <div
              key={service.id}
              className={`flex w-full items-center gap-3 rounded-xl border border-border-default bg-surface-raised/60 px-4 py-3 border-l-[3px] transition-all ${
                isOnline ? "border-l-accent-green" : "border-l-border-subtle"
              } ${
                isHighlighted
                  ? "ring-1 ring-accent-cyan/40 shadow-[0_0_0_1px_rgba(103,232,249,0.14)]"
                  : ""
              }`}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border-subtle bg-surface-sunken/50">
                <Server className={`h-4.5 w-4.5 ${isOnline ? "text-accent-green/70" : "text-muted-foreground/40"}`} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-body-sm font-medium text-foreground">
                    {service.name}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <div
                      className={`h-2 w-2 rounded-full ${
                        isOnline ? "bg-accent-green animate-pulse" : "bg-muted-foreground/30"
                      }`}
                    />
                    <span className="text-caption text-muted-foreground">
                      {isOnline ? "Online" : "Offline"}
                    </span>
                  </div>
                </div>
                <span className="mt-0.5 block truncate font-mono text-caption text-muted-foreground/40">
                  {service.serviceId.slice(0, 12)}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                {isOnline ? (
                  <>
                    <button
                      onClick={() => handleNewTerminal(service)}
                      disabled={isCreating}
                      className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-cyan/10 text-accent-cyan transition-colors active:scale-[0.95] active:bg-accent-cyan/20 disabled:opacity-30"
                    >
                      <Terminal className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setEditorServiceId(service.id)}
                      className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-blue/10 text-accent-blue transition-colors active:scale-[0.95] active:bg-accent-blue/20 disabled:opacity-30"
                    >
                      <FileCode className="h-4 w-4" />
                    </button>
                  </>
                ) : (
                  <button
                    onClick={async () => {
                      try {
                        await deleteService(service.id);
                        toast.success("Host removed");
                      } catch {
                        toast.error("Failed to remove host");
                      }
                    }}
                    className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-red/10 text-accent-red transition-colors active:scale-[0.95] active:bg-accent-red/15"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {editorServiceId && (
        <EditorFullScreen
          serviceId={editorServiceId}
          onBack={() => setEditorServiceId(null)}
        />
      )}
    </>
  );
}

/* ─── Inline Connect Host ────────────────────────────────────────────────── */

function ConnectHostInline({
  workspaceId,
  apiKey,
}: Readonly<{
  workspaceId: string;
  apiKey: string;
}>) {
  const { copy, isCopied } = useCopyWithFeedback();
  const hubUrl = getHubUrl();
  const params = { hubUrl, workspaceId, apiKey };
  const runCmd = buildRunCommand(params);
  const envFile = buildEnvFile(params);

  return (
    <div className="px-4 py-5 space-y-5">
      <div className="space-y-1.5">
        <h2 className="text-body font-semibold text-foreground">
          Connect a host
        </h2>
        <p className="text-body-sm leading-relaxed text-muted-foreground">
          Install the Excaliterm agent on the machine you want to connect, then
          run it with your workspace credentials.
        </p>
      </div>

      {/* Step 1: Install */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-caption font-medium text-muted-foreground">
            1. Install the package
          </span>
          <CopyButton
            variant="plain"
            copied={isCopied("install")}
            onClick={() => copy(INSTALL_CMD, "install")}
          />
        </div>
        <pre className="overflow-x-auto rounded-lg border border-border bg-surface-sunken p-3 font-mono text-caption leading-relaxed text-foreground">
          {INSTALL_CMD}
        </pre>
      </div>

      {/* Step 2: Run */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-caption font-medium text-muted-foreground">
            2. Run the agent
          </span>
          <CopyButton
            variant="plain"
            copied={isCopied("command")}
            onClick={() => copy(runCmd, "command")}
          />
        </div>
        <pre className="overflow-x-auto rounded-lg border border-border bg-surface-sunken p-3 font-mono text-caption leading-relaxed text-foreground">
          {runCmd}
        </pre>
      </div>

      {/* Alternative: .env */}
      <details className="group">
        <summary className="cursor-pointer text-caption text-muted-foreground hover:text-foreground">
          Or use environment variables / .env file
        </summary>
        <div className="mt-2 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-caption font-medium text-muted-foreground">
              .env
            </span>
            <CopyButton
              variant="plain"
              copied={isCopied("env")}
              onClick={() => copy(envFile, "env")}
            />
          </div>
          <pre className="overflow-x-auto rounded-lg border border-border bg-surface-sunken p-3 font-mono text-caption leading-relaxed text-foreground">
            {envFile}
          </pre>
          <p className="text-caption text-muted-foreground">
            Then run{" "}
            <code className="rounded bg-surface-sunken px-1">excaliterm</code>{" "}
            or{" "}
            <code className="rounded bg-surface-sunken px-1">
              npx excaliterm
            </code>
          </p>
        </div>
      </details>

      {/* Hint */}
      <div className="flex items-start gap-2 rounded-lg border border-border bg-surface-sunken px-3 py-2.5">
        <Plus className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <p className="text-caption leading-relaxed text-muted-foreground">
          The host will appear here automatically once the agent connects.
        </p>
      </div>
    </div>
  );
}

/* ─── Missing API Key Recovery ──────────────────────────────────────────── */

function MissingApiKeyRecovery() {
  const { create, creating } = useCreateWorkspace();
  return (
    <div className="px-4 py-5 space-y-4">
      <MissingApiKeyExplainer />
      <Button
        onClick={create}
        disabled={creating}
        className="h-11 w-full gap-2 rounded-xl"
      >
        <Sparkles className="h-4 w-4" />
        {creating ? "Creating..." : "Create new workspace"}
      </Button>
    </div>
  );
}
