import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { z } from "zod";

const TerminalRefSchema = z.object({
  id: z.string().min(1),
  readToken: z.string().min(1),
});

const TriggerRefSchema = z.object({
  id: z.string().min(1),
  token: z.string().min(1),
});

export const ConfigSchema = z.object({
  baseUrl: z.string().url(),
  terminals: z.record(z.string(), TerminalRefSchema).default({}),
  triggers: z.record(z.string(), TriggerRefSchema).default({}),
});

export type Config = z.infer<typeof ConfigSchema>;
export type TerminalRef = z.infer<typeof TerminalRefSchema>;
export type TriggerRef = z.infer<typeof TriggerRefSchema>;

const DEFAULT_PATH = path.join(os.homedir(), ".excaliterm", "mcp.json");

export function resolveConfigPath(): string {
  const fromEnv = process.env.EXCALITERM_CONFIG?.trim();
  if (fromEnv && fromEnv.length > 0) {
    return fromEnv.startsWith("~")
      ? path.join(os.homedir(), fromEnv.slice(1))
      : fromEnv;
  }
  return DEFAULT_PATH;
}

export function loadConfig(filePath = resolveConfigPath()): Config {
  let raw: string;
  try {
    raw = fs.readFileSync(filePath, "utf8");
  } catch (err) {
    throw new Error(
      `Failed to read Excaliterm MCP config at ${filePath}: ${(err as Error).message}\n` +
        `Set EXCALITERM_CONFIG to a different path, or create ~/.excaliterm/mcp.json from the "Connect an agent" dialog in the canvas.`,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`Malformed JSON in ${filePath}: ${(err as Error).message}`);
  }

  const result = ConfigSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid Excaliterm MCP config at ${filePath}:\n${issues}`);
  }
  return result.data;
}

export function getTerminal(config: Config, name: string): TerminalRef {
  const t = config.terminals[name];
  if (!t) {
    const known = Object.keys(config.terminals).join(", ") || "(none)";
    throw new Error(`No such terminal in config: "${name}". Known: ${known}.`);
  }
  return t;
}

export function getTrigger(config: Config, name: string): TriggerRef {
  const t = config.triggers[name];
  if (!t) {
    const known = Object.keys(config.triggers).join(", ") || "(none)";
    throw new Error(`No such trigger in config: "${name}". Known: ${known}.`);
  }
  return t;
}
