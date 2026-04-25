import { z } from "zod";
import { type Config, getTerminal } from "../config.js";
import { apiCall } from "../lib/api.js";

export const readTerminalSchema = {
  name: z.string().describe("Friendly terminal name from your mcp.json (e.g. 'worker')."),
  lines: z
    .number()
    .int()
    .min(1)
    .max(1000)
    .default(200)
    .describe("Number of trailing lines of output to return. Max 1000."),
};

export interface ReadTerminalArgs {
  name: string;
  lines?: number;
}

export interface ReadTerminalResult {
  terminalId: string;
  lines: string[];
  totalLines: number;
  capturedAt: string;
}

export async function readTerminal(
  config: Config,
  args: ReadTerminalArgs,
  fetchImpl: typeof fetch = fetch,
): Promise<ReadTerminalResult> {
  const terminal = getTerminal(config, args.name);
  const lines = args.lines ?? 200;
  return apiCall<ReadTerminalResult>(config, {
    toolName: "read_terminal",
    path: `/api/terminals/${terminal.id}/output?lines=${lines}`,
    headers: { "X-Terminal-Read-Token": terminal.readToken },
    fetchImpl,
  });
}
