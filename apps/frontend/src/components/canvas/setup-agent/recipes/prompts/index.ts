import type { SidecarIdentity, WorkerCli } from "../types";
import { claudeStarterPrompt } from "./claude";
import { codexStarterPrompt } from "./codex";
import { aiderStarterPrompt } from "./aider";
import { genericStarterPrompt } from "./generic";

export function starterPromptFor(
  cli: WorkerCli,
  identity: SidecarIdentity,
): string {
  switch (cli) {
    case "claude":
      return claudeStarterPrompt(identity);
    case "codex":
      return codexStarterPrompt(identity);
    case "aider":
      return aiderStarterPrompt(identity);
    case "custom":
      return genericStarterPrompt(identity);
  }
}
