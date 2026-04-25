#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config.js";
import {
  readTerminal,
  readTerminalSchema,
  type ReadTerminalArgs,
} from "./tools/read.js";
import {
  sendTerminal,
  sendTerminalSchema,
  type SendTerminalArgs,
} from "./tools/send.js";

async function main() {
  const config = loadConfig();

  const server = new McpServer({
    name: "@excaliterm/mcp-tools",
    version: "0.1.0",
  });

  server.tool(
    "read_terminal",
    "Read the last N lines of output from an Excaliterm terminal in this workspace.",
    readTerminalSchema,
    async (args: ReadTerminalArgs) => {
      const result = await readTerminal(config, args);
      return {
        content: [
          { type: "text", text: result.lines.join("\n") || "(no output)" },
        ],
      };
    },
  );

  server.tool(
    "send_terminal",
    "Send a command to an Excaliterm terminal. Behaves as if typed + Enter.",
    sendTerminalSchema,
    async (args: SendTerminalArgs) => {
      const result = await sendTerminal(config, args);
      return {
        content: [
          { type: "text", text: `Fired at ${result.firedAt}` },
        ],
      };
    },
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("[excaliterm-mcp] fatal:", err.message);
  process.exit(1);
});
