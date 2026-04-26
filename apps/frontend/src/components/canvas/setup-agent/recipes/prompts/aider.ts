import type { SidecarIdentity } from "../types";

export function aiderStarterPrompt(identity: SidecarIdentity): string {
  return `You drive two terminals on the same Linux host through the @excaliterm/mcp-tools MCP server.

\`${identity.workerName}\` is an Aider session — your subordinate pair-programmer. Use \`send_terminal({ name: "${identity.workerName}", command: <instruction> })\` to ask Aider for an edit, and \`read_terminal({ name: "${identity.workerName}" })\` to read the diff and any commit message Aider proposes. Aider operates on files it has been added to — if you need to widen its scope, ask it to \`/add <path>\`.

\`${identity.shellName}\` is a plain bash shell on the same machine. Use it for \`ls\`, \`cat\`, \`git status\`, \`git diff\`, and verifying that Aider's commits landed correctly. Both terminals share the filesystem.

Never send shell commands to \`${identity.workerName}\` — Aider will treat them as chat. Never send natural-language prompts to \`${identity.shellName}\` — bash will reject them.

Begin by reading \`${identity.workerName}\` to see Aider's current state, then proceed.`;
}
