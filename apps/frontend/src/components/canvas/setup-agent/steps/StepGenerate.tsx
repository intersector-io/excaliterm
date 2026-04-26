import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Hammer, RotateCw, Trash2 } from "lucide-react";
import { useWorkspace } from "@/hooks/use-workspace";
import { useSetupAgentStore } from "@/stores/setup-agent-store";
import { logWizardEvent } from "@/lib/wizard-telemetry";
import { runSidecarRecipe } from "../lib/runRecipe";
import { rollbackArtifacts } from "../lib/rollback";
import { BuildChecklist } from "../BuildChecklist";
import { GhostCanvasPreview } from "../GhostCanvasPreview";

export function StepGenerate() {
  const queryClient = useQueryClient();
  const { workspaceId } = useWorkspace();

  const phase = useSetupAgentStore((s) => s.generatePhase);
  const setPhase = useSetupAgentStore((s) => s.setGeneratePhase);
  const buildSteps = useSetupAgentStore((s) => s.buildSteps);
  const identity = useSetupAgentStore((s) => s.identity);
  const hostId = useSetupAgentStore((s) => s.hostId);
  const setStep = useSetupAgentStore((s) => s.setStep);
  const resetBuildSteps = useSetupAgentStore((s) => s.resetBuildSteps);
  const artifacts = useSetupAgentStore((s) => s.artifacts);
  const startedRef = useRef<number>(0);

  const workerSpawned = !!artifacts.workerNodeId;
  const shellSpawned = !!artifacts.shellNodeId;
  const workerTriggerSpawned = !!artifacts.workerTriggerId;
  const shellTriggerSpawned = !!artifacts.shellTriggerId;

  async function start() {
    if (!hostId) return;
    resetBuildSteps();
    setPhase("building");
    startedRef.current = Date.now();

    const result = await runSidecarRecipe({
      workspaceId,
      hostServiceInstanceId: hostId,
      queryClient,
    });

    if (result.ok) {
      logWizardEvent("recipe_built", {
        recipe: "coding-agent-with-sidecar-shell",
        durationMs: Date.now() - startedRef.current,
      });
      setPhase("done");
    } else {
      setPhase("failed");
    }
  }

  // Auto-advance to verify shortly after a successful build, so the user
  // sees the canvas materialization play out without an extra click.
  useEffect(() => {
    if (phase !== "done") return;
    const t = setTimeout(() => setStep("verify"), 1100);
    return () => clearTimeout(t);
  }, [phase, setStep]);

  // One-shot: ~1.5s after build completes, drop all id markers so the
  // animation doesn't replay if a node remounts.
  useEffect(() => {
    if (phase !== "done") return;
    const t = setTimeout(() => {
      const { justSpawned: snapshot, clearSpawned } = useSetupAgentStore.getState();
      for (const id of snapshot) clearSpawned(id);
    }, 1500);
    return () => clearTimeout(t);
  }, [phase]);

  async function handleRollback() {
    await rollbackArtifacts({ workspaceId, reason: "user", queryClient });
    logWizardEvent("rolled_back", { reason: "user", atStep: "generate" });
    resetBuildSteps();
    setPhase("preview");
    useSetupAgentStore.setState({ artifacts: {} });
  }

  async function handleRetry() {
    // Rolling back any half-built artifacts before retrying keeps state clean.
    await rollbackArtifacts({ workspaceId, reason: "auto", queryClient });
    useSetupAgentStore.setState({ artifacts: {} });
    void start();
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-h1 font-semibold tracking-tight">
          {phase === "preview" && "Ready to build."}
          {phase === "building" && "Building…"}
          {phase === "done" && "Built. Verifying next."}
          {phase === "failed" && "Hit a snag."}
        </h2>
        <p className="mt-1 text-body-sm text-muted-foreground">
          {phase === "preview" &&
            `This will create 2 terminals and 2 HTTP triggers on the selected host. Nothing is built yet.`}
          {phase === "building" &&
            "Watch the canvas behind this dialog — the nodes materialize as we go."}
          {phase === "done" && "Both terminals are live. Moving to a quick connection test."}
          {phase === "failed" &&
            "One of the steps failed. Retry to re-run only the failed step, or roll back to start over."}
        </p>
      </div>

      <GhostCanvasPreview
        workerName={identity.workerName}
        shellName={identity.shellName}
        workerSpawned={workerSpawned}
        shellSpawned={shellSpawned}
        workerTrigger={workerTriggerSpawned}
        shellTrigger={shellTriggerSpawned}
      />

      <BuildChecklist steps={buildSteps} />

      {phase === "preview" && (
        <div className="flex justify-end">
          <button
            onClick={() => void start()}
            disabled={!hostId}
            className="flex items-center gap-2 rounded-md border border-accent-amber/40 bg-accent-amber/15 px-4 py-2 font-mono text-body-sm text-accent-amber transition-all hover:bg-accent-amber/20 disabled:opacity-40"
          >
            <Hammer className="h-3.5 w-3.5" />
            Build it
          </button>
        </div>
      )}

      {phase === "failed" && (
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={() => void handleRollback()}
            className="flex items-center gap-2 rounded-md border border-white/10 px-3 py-1.5 text-body-sm text-muted-foreground hover:bg-white/[0.04] hover:text-foreground"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Roll back
          </button>
          <button
            onClick={() => void handleRetry()}
            className="flex items-center gap-2 rounded-md border border-accent-amber/40 bg-accent-amber/15 px-4 py-2 font-mono text-body-sm text-accent-amber hover:bg-accent-amber/20"
          >
            <RotateCw className="h-3.5 w-3.5" />
            Retry
          </button>
        </div>
      )}
    </div>
  );
}
