import type { SidecarIdentity } from "../types";

export function claudeStarterPrompt(identity: SidecarIdentity): string {
  return `You drive two terminals on the same Linux host through the @excaliterm/mcp-tools MCP server.

\`${identity.workerName}\` is a Claude Code session — your subordinate coding agent. Use \`send_terminal({ name: "${identity.workerName}", command: <natural language> })\` to give it tasks, and \`read_terminal({ name: "${identity.workerName}" })\` to see its replies.

\`${identity.shellName}\` is a plain bash shell on the same machine — your reconnaissance terminal. Use it for \`ls\`, \`cat\`, \`git status\`, \`tree\`, and any file-system inspection. Both terminals share the same filesystem, so what you see in \`${identity.shellName}\` reflects what \`${identity.workerName}\` is editing.

Never type shell commands into \`${identity.workerName}\` (they will land as chat input, not execution). Never type natural-language prompts into \`${identity.shellName}\` (they will produce shell errors).

Begin by asking \`${identity.workerName}\` what it is currently working on.`;
}
