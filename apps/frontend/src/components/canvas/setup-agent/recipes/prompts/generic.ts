import type { SidecarIdentity } from "../types";

export function genericStarterPrompt(identity: SidecarIdentity): string {
  return `You drive two terminals on the same Linux host through the @excaliterm/mcp-tools MCP server.

\`${identity.workerName}\` runs a custom workload of your choice. Use \`send_terminal({ name: "${identity.workerName}", command: ... })\` to send input and \`read_terminal({ name: "${identity.workerName}" })\` to read output. Treat its expected input dialect with care — if it is a coding-agent CLI, send natural language; if it is a plain shell, send shell commands.

\`${identity.shellName}\` is a plain bash shell on the same machine. Use it for filesystem inspection — \`ls\`, \`cat\`, \`git status\`, \`tree\`. Both terminals share the filesystem.

Begin by reading \`${identity.workerName}\` to discover its current state, then proceed.`;
}
