import { useSetupAgentStore } from "@/stores/setup-agent-store";

/**
 * Returns a CSS class to apply to a canvas node based on whether it was
 * just spawned by the wizard, or is currently being torn down by an
 * explicit user-initiated rollback. Returns "" otherwise.
 *
 * Combined into one selector so a single Set mutation only triggers a
 * re-render in the node whose id actually changed bucket — not every node.
 */
export function useNodeSpawnClass(nodeId: string): string {
  return useSetupAgentStore((s) => {
    if (s.reverseSpawning.has(nodeId)) return "wizard-node-despawn";
    if (s.justSpawned.has(nodeId)) return "wizard-node-spawn";
    return "";
  });
}
