import { useSetupAgentStore } from "@/stores/setup-agent-store";
import { sanitizeIdentifier } from "@/lib/utils";
import type { WorkerCli } from "../recipes/types";

const CLI_OPTIONS: { value: WorkerCli; label: string }[] = [
  { value: "claude", label: "claude" },
  { value: "codex", label: "codex" },
  { value: "aider", label: "aider" },
  { value: "custom", label: "custom command…" },
];

export function StepIdentity() {
  const identity = useSetupAgentStore((s) => s.identity);
  const patch = useSetupAgentStore((s) => s.patchIdentity);

  const namesCollide =
    identity.workerName.trim().length > 0 &&
    identity.workerName === identity.shellName;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-h1 font-semibold tracking-tight">Name your terminals.</h2>
        <p className="mt-1 text-body-sm text-muted-foreground">
          The supervisor uses these names to address each terminal — they become tool argument values. Pick names you'll recognize in 6 months.
        </p>
      </div>

      {/* Worker card */}
      <div className="rounded-lg border border-border-subtle/60 bg-card overflow-hidden">
        <div className="border-b border-border-subtle/60 px-4 py-2">
          <span className="font-mono text-caption uppercase tracking-[0.18em] text-accent-amber/70">
            worker terminal
          </span>
        </div>
        <div className="grid grid-cols-[100px_1fr] gap-x-4 gap-y-3 p-4">
          <label className="flex items-center font-mono text-caption text-muted-foreground">name</label>
          <input
            type="text"
            value={identity.workerName}
            onChange={(e) => patch({ workerName: sanitizeIdentifier(e.target.value) })}
            spellCheck={false}
            className={`rounded-md border bg-surface-sunken px-2 py-1 font-mono text-body-sm text-foreground/90 outline-none focus:border-accent-amber/40 ${
              namesCollide ? "border-accent-red/60" : "border-border-subtle"
            }`}
          />

          <label className="flex items-center font-mono text-caption text-muted-foreground">cli</label>
          <div className="flex items-center gap-2">
            <select
              value={identity.workerCli}
              onChange={(e) => patch({ workerCli: e.target.value as WorkerCli })}
              className="rounded-md border border-border-subtle bg-surface-sunken px-2 py-1 font-mono text-body-sm text-foreground/90 outline-none focus:border-accent-amber/40"
            >
              {CLI_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            {identity.workerCli === "custom" && (
              <input
                type="text"
                value={identity.workerCustomCommand}
                onChange={(e) => patch({ workerCustomCommand: e.target.value })}
                placeholder="leave empty to skip launch"
                spellCheck={false}
                className="flex-1 rounded-md border border-border-subtle bg-surface-sunken px-2 py-1 font-mono text-body-sm text-foreground/90 outline-none focus:border-accent-amber/40"
              />
            )}
          </div>
        </div>
      </div>

      {/* Bridge */}
      <div className="flex items-center justify-center -my-2">
        <div className="flex items-center gap-3">
          <div className="h-px w-12 bg-accent-amber/30" />
          <span className="font-mono text-caption uppercase tracking-[0.18em] text-accent-amber/60">
            sidecar bridge
          </span>
          <div className="h-px w-12 bg-accent-amber/30" />
        </div>
      </div>

      {/* Shell card */}
      <div className="rounded-lg border border-border-subtle/60 bg-card overflow-hidden">
        <div className="border-b border-border-subtle/60 px-4 py-2">
          <span className="font-mono text-caption uppercase tracking-[0.18em] text-white/55">
            sidecar shell
          </span>
        </div>
        <div className="grid grid-cols-[100px_1fr] gap-x-4 gap-y-3 p-4">
          <label className="flex items-center font-mono text-caption text-muted-foreground">name</label>
          <input
            type="text"
            value={identity.shellName}
            onChange={(e) => patch({ shellName: sanitizeIdentifier(e.target.value) })}
            spellCheck={false}
            className={`rounded-md border bg-surface-sunken px-2 py-1 font-mono text-body-sm text-foreground/90 outline-none focus:border-accent-amber/40 ${
              namesCollide ? "border-accent-red/60" : "border-border-subtle"
            }`}
          />
          <label className="flex items-center font-mono text-caption text-muted-foreground">role</label>
          <span className="flex items-center font-mono text-caption text-muted-foreground/70">
            plain bash — used by the supervisor for recon (ls, cat, git status)
          </span>
        </div>
      </div>

      {namesCollide && (
        <p className="text-caption text-accent-red">
          Worker and shell can't share a name — the supervisor needs to address them separately.
        </p>
      )}
    </div>
  );
}
