import * as api from "@/lib/api-client";
import type { QueryClient } from "@tanstack/react-query";
import {
  useSetupAgentStore,
  type BuildStepId,
} from "@/stores/setup-agent-store";
import { workerCliCommand } from "../recipes/types";
import { fireTriggerPublic } from "./public-pipe";

/**
 * Sequential recipe orchestrator. Each step writes status to the store so
 * StepGenerate can render progress in real time. On failure, the chain
 * halts and the caller surfaces Retry/Roll back.
 */
export async function runSidecarRecipe(args: {
  workspaceId: string;
  hostServiceInstanceId: string;
  queryClient: QueryClient;
}): Promise<{ ok: true } | { ok: false; failedStep: BuildStepId }> {
  const store = useSetupAgentStore.getState();
  const identity = store.identity;
  const { workspaceId, hostServiceInstanceId, queryClient } = args;

  const setBuildStep = useSetupAgentStore.getState().setBuildStep;
  const patchArtifacts = useSetupAgentStore.getState().patchArtifacts;
  const markSpawned = useSetupAgentStore.getState().markSpawned;

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["terminals", workspaceId] });
    queryClient.invalidateQueries({ queryKey: ["triggers", workspaceId] });
    queryClient.invalidateQueries({ queryKey: ["canvas-nodes", workspaceId] });
    queryClient.invalidateQueries({ queryKey: ["canvas-edges", workspaceId] });
  }

  async function step<T>(
    id: BuildStepId,
    fn: () => Promise<T>,
  ): Promise<T | null> {
    setBuildStep(id, { status: "running", error: undefined });
    try {
      const result = await fn();
      setBuildStep(id, { status: "ok" });
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "unknown error";
      setBuildStep(id, { status: "failed", error: msg });
      return null;
    }
  }

  // 1. Spawn worker terminal — left of center
  const worker = await step("spawn-worker", () =>
    api.createTerminal(workspaceId, {
      serviceInstanceId: hostServiceInstanceId,
      x: -340,
      y: 0,
      tags: ["wizard", "worker", identity.workerName],
    }),
  );
  if (!worker) return { ok: false, failedStep: "spawn-worker" };
  patchArtifacts({
    workerTerminalId: worker.terminal.id,
    workerNodeId: worker.canvasNode.id,
    workerReadToken: worker.terminal.readToken ?? "",
  });
  markSpawned(worker.canvasNode.id);

  // 2. Spawn shell terminal — right of center
  const shell = await step("spawn-shell", () =>
    api.createTerminal(workspaceId, {
      serviceInstanceId: hostServiceInstanceId,
      x: 340,
      y: 0,
      tags: ["wizard", "sidecar", identity.shellName],
    }),
  );
  if (!shell) return { ok: false, failedStep: "spawn-shell" };
  patchArtifacts({
    shellTerminalId: shell.terminal.id,
    shellNodeId: shell.canvasNode.id,
    shellReadToken: shell.terminal.readToken ?? "",
  });
  markSpawned(shell.canvasNode.id);

  // 3. Worker HTTP trigger
  const workerTrigger = await step("trigger-worker", () =>
    api.createTrigger(workspaceId, {
      terminalNodeId: worker.canvasNode.id,
      type: "http",
    }),
  );
  if (!workerTrigger) return { ok: false, failedStep: "trigger-worker" };
  const workerSecret =
    (workerTrigger.trigger.config as { secret?: string }).secret ?? "";
  patchArtifacts({
    workerTriggerId: workerTrigger.trigger.id,
    workerTriggerSecret: workerSecret,
  });
  markSpawned(workerTrigger.canvasNode.id);

  // 4. Shell HTTP trigger
  const shellTrigger = await step("trigger-shell", () =>
    api.createTrigger(workspaceId, {
      terminalNodeId: shell.canvasNode.id,
      type: "http",
    }),
  );
  if (!shellTrigger) return { ok: false, failedStep: "trigger-shell" };
  const shellSecret =
    (shellTrigger.trigger.config as { secret?: string }).secret ?? "";
  patchArtifacts({
    shellTriggerId: shellTrigger.trigger.id,
    shellTriggerSecret: shellSecret,
  });
  markSpawned(shellTrigger.canvasNode.id);

  // 5. Enable both triggers
  const enabled = await step("enable-triggers", () =>
    Promise.all([
      api.updateTrigger(workspaceId, workerTrigger.trigger.id, { enabled: true }),
      api.updateTrigger(workspaceId, shellTrigger.trigger.id, { enabled: true }),
    ]),
  );
  if (enabled === null) return { ok: false, failedStep: "enable-triggers" };

  // 6. Launch the worker CLI by firing the worker trigger once.
  // For `custom` with empty command this is a no-op (skipped, marked OK).
  const cliCommand = workerCliCommand(identity);
  const launched = await step("launch-cli", async () => {
    if (!cliCommand) {
      // Skipped intentionally — no command for custom
      return;
    }
    await fireTriggerPublic({
      triggerId: workerTrigger.trigger.id,
      triggerSecret: workerSecret,
      prompt: cliCommand,
    });
  });
  if (launched === null) return { ok: false, failedStep: "launch-cli" };

  invalidate();
  return { ok: true };
}
