import { z } from "zod";
import { type Config, getTrigger } from "../config.js";
import { apiCall } from "../lib/api.js";

export const sendTerminalSchema = {
  name: z
    .string()
    .describe("Friendly trigger name from your mcp.json (e.g. 'worker')."),
  command: z
    .string()
    .min(1)
    .describe(
      "Shell command to execute. Behaves as if typed into the terminal. Final Enter is added automatically.",
    ),
  requireIdleSec: z
    .number()
    .int()
    .min(1)
    .max(3600)
    .optional()
    .describe(
      "Optional. If set, the call returns 409 when the terminal has produced output within the last N seconds.",
    ),
};

export interface SendTerminalArgs {
  name: string;
  command: string;
  requireIdleSec?: number;
}

export interface SendTerminalResult {
  ok: boolean;
  firedAt: string;
}

export async function sendTerminal(
  config: Config,
  args: SendTerminalArgs,
  fetchImpl: typeof fetch = fetch,
): Promise<SendTerminalResult> {
  const trigger = getTrigger(config, args.name);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Trigger-Token": trigger.token,
  };
  if (args.requireIdleSec) {
    headers["X-Trigger-Require-Idle"] = String(args.requireIdleSec);
  }
  return apiCall<SendTerminalResult>(config, {
    toolName: "send_terminal",
    method: "POST",
    path: `/api/triggers/${trigger.id}/fire`,
    headers,
    body: { prompt: args.command },
    fetchImpl,
  });
}
