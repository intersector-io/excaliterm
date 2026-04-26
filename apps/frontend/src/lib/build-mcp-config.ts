import type { Trigger } from "@excaliterm/shared-types";

const MASKED = "•".repeat(36);

export interface McpTerminalEntry {
  id: string;
  name: string;
  readToken: string;
}

export interface McpTriggerEntry {
  id: string;
  name: string;
  trigger: Trigger;
}

export interface BuildMcpConfigInput {
  baseUrl: string;
  terminals: McpTerminalEntry[];
  triggers: McpTriggerEntry[];
  mask: boolean;
}

export function buildMcpConfig({
  baseUrl,
  terminals,
  triggers,
  mask,
}: BuildMcpConfigInput): string {
  const terminalsObj: Record<string, { id: string; readToken: string }> = {};
  for (const t of terminals) {
    terminalsObj[t.name] = {
      id: t.id,
      readToken: mask ? MASKED : t.readToken,
    };
  }

  const triggersObj: Record<string, { id: string; token: string }> = {};
  for (const t of triggers) {
    const cfg = t.trigger.config as { secret?: string };
    triggersObj[t.name] = {
      id: t.trigger.id,
      token: mask ? MASKED : (cfg.secret ?? ""),
    };
  }

  return JSON.stringify(
    { baseUrl, terminals: terminalsObj, triggers: triggersObj },
    null,
    2,
  );
}
