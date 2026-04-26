import { toast } from "sonner";
import * as api from "@/lib/api-client";
import type { QueryClient } from "@tanstack/react-query";
import { useSetupAgentStore } from "@/stores/setup-agent-store";

export type RollbackReason = "auto" | "user";

/**
 * Tear down whatever the orchestrator created in this session.
 * Triggers first, terminals second (cascading would also work, but the
 * explicit order is friendlier to the SignalR canvas-node deletes).
 */
export async function rollbackArtifacts(args: {
  workspaceId: string;
  reason: RollbackReason;
  queryClient: QueryClient;
}): Promise<void> {
  const { workspaceId, reason, queryClient } = args;
  const store = useSetupAgentStore.getState();
  const a = store.artifacts;

  const beginReverseSpawn = useSetupAgentStore.getState().beginReverseSpawn;
  if (reason === "user") {
    const ids = [
      a.workerNodeId,
      a.shellNodeId,
    ].filter((id): id is string => Boolean(id));
    beginReverseSpawn(ids);
    // Give the reverse animation a moment to play before the DOM is ripped.
    await new Promise((r) => setTimeout(r, 280));
  }

  const safeDelete = (fn: () => Promise<unknown>) =>
    fn().catch(() => {});

  await Promise.all(
    [
      a.workerTriggerId && safeDelete(() => api.deleteTrigger(workspaceId, a.workerTriggerId!)),
      a.shellTriggerId && safeDelete(() => api.deleteTrigger(workspaceId, a.shellTriggerId!)),
      a.workerTerminalId && safeDelete(() => api.deleteTerminal(workspaceId, a.workerTerminalId!)),
      a.shellTerminalId && safeDelete(() => api.deleteTerminal(workspaceId, a.shellTerminalId!)),
    ].filter(Boolean) as Promise<void>[],
  );

  queryClient.invalidateQueries({ queryKey: ["terminals", workspaceId] });
  queryClient.invalidateQueries({ queryKey: ["triggers", workspaceId] });
  queryClient.invalidateQueries({ queryKey: ["canvas-nodes", workspaceId] });
  queryClient.invalidateQueries({ queryKey: ["canvas-edges", workspaceId] });

  if (reason === "auto") {
    toast("Cleaned up partial setup.");
  } else {
    toast.success("Setup rolled back.");
  }
}
