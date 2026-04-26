export type RecipeId =
  | "coding-agent-with-sidecar-shell"
  | "watch-a-worker"
  | "babysit-a-dev-server";

export type WorkerCli = "claude" | "codex" | "aider" | "custom";

export interface RecipeSummary {
  id: RecipeId;
  title: string;
  tagline: string;
  badge?: "recommended";
  topology: "single" | "paired" | "single-with-trigger";
}

export interface SidecarIdentity {
  workerName: string;
  shellName: string;
  workerCli: WorkerCli;
  workerCustomCommand: string;
  workerCwd: string;
  shellShareCwd: boolean;
}

export const DEFAULT_IDENTITY: SidecarIdentity = {
  workerName: "codex_worker_linux",
  shellName: "linux_shell",
  workerCli: "claude",
  workerCustomCommand: "",
  workerCwd: "~",
  shellShareCwd: true,
};

export function workerCliCommand(identity: SidecarIdentity): string | null {
  if (identity.workerCli === "custom") {
    const trimmed = identity.workerCustomCommand.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  return identity.workerCli;
}
