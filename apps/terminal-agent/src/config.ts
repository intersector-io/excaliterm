import os from "node:os";
import { parseArgs } from "node:util";

export interface Config {
  signalrHubUrl: string;
  serviceApiKey: string;
  serviceId: string;
  workspaceId: string;
  whitelistedPaths: string[];
  shell: string;
  shellArgs: string[];
}

function detectShell(): { shell: string; shellArgs: string[] } {
  if (process.platform === "win32") {
    // Use a clean PowerShell session so web terminals do not inherit decorative prompts.
    return {
      shell: "powershell.exe",
      shellArgs: ["-NoLogo", "-NoProfile"],
    };
  }
  return {
    shell: process.env.SHELL || "/bin/bash",
    shellArgs: [],
  };
}

function generateServiceId(): string {
  const hostname = os.hostname();
  const pid = process.pid;
  return `${hostname}-${pid}`;
}

function printHelp(): never {
  console.log(`
Usage: excaliterm [options]

Options:
  --hub-url <url>            SignalR hub URL (env: SIGNALR_HUB_URL)
  --api-key <key>            Service API key (env: SERVICE_API_KEY)
  --workspace-id <id>        Workspace ID (env: WORKSPACE_ID)
  --service-id <id>          Service ID (env: SERVICE_ID, default: hostname-pid)
  --whitelisted-paths <paths> Comma-separated paths (env: WHITELISTED_PATHS)
  --shell <path>             Shell executable override (env: SHELL_OVERRIDE)
  --help                     Show this help message

Environment variables can be set in a .env file or passed directly.
CLI arguments take precedence over environment variables.

Examples:
  excaliterm --hub-url https://hub.example.com --api-key secret123 --workspace-id abc-123
  SERVICE_API_KEY=secret123 excaliterm --hub-url https://hub.example.com
  npx excaliterm --hub-url https://hub.example.com --api-key secret123
`);
  process.exit(0);
}

function parseCli() {
  const { values } = parseArgs({
    options: {
      "hub-url": { type: "string" },
      "api-key": { type: "string" },
      "workspace-id": { type: "string" },
      "service-id": { type: "string" },
      "whitelisted-paths": { type: "string" },
      shell: { type: "string" },
      help: { type: "boolean", short: "h" },
    },
    strict: true,
    allowPositionals: false,
  });

  if (values.help) printHelp();

  return values;
}

export function loadConfig(): Config {
  const cli = parseCli();

  const apiKey = cli["api-key"] ?? process.env.SERVICE_API_KEY;
  if (!apiKey) {
    throw new Error(
      "SERVICE_API_KEY is required. Pass --api-key <key> or set the SERVICE_API_KEY environment variable.",
    );
  }

  const whitelistedRaw = cli["whitelisted-paths"] ?? process.env.WHITELISTED_PATHS ?? "";
  const whitelistedPaths = whitelistedRaw
    .split(",")
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  const shellOverride = (cli.shell ?? process.env.SHELL_OVERRIDE)?.trim();
  const detectedShell = detectShell();

  return {
    signalrHubUrl: cli["hub-url"] ?? process.env.SIGNALR_HUB_URL ?? "http://localhost:5000",
    serviceApiKey: apiKey,
    serviceId: cli["service-id"] ?? process.env.SERVICE_ID ?? generateServiceId(),
    workspaceId:
      cli["workspace-id"] ?? process.env.WORKSPACE_ID ?? "00000000-0000-0000-0000-000000000000",
    whitelistedPaths,
    shell: shellOverride ?? detectedShell.shell,
    shellArgs: shellOverride ? [] : detectedShell.shellArgs,
  };
}
