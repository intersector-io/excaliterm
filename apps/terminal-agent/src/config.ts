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
Usage: excaliterm [options] [allowed-path...]

Options:
  --hub-url <url>        SignalR hub URL (env: SIGNALR_HUB_URL)
  --api-key <key>        Service API key (env: SERVICE_API_KEY)
  --workspace-id <id>    Workspace ID (env: WORKSPACE_ID)
  --service-id <id>      Service ID (env: SERVICE_ID, default: hostname-pid)
  --allow <path>         Allow filesystem access under <path>. Repeat for
                         multiple roots. Positional arguments are also
                         treated as --allow entries. (env: WHITELISTED_PATHS,
                         comma-separated)
  --shell <path>         Shell executable override (env: SHELL_OVERRIDE)
  --help                 Show this help message

By default no filesystem paths are exposed. Pass --allow (or positionals)
to whitelist directories. CLI values merge with WHITELISTED_PATHS.

Examples:
  excaliterm --hub-url https://hub.example.com --api-key secret123 ./src ./docs
  excaliterm --allow /var/log --allow /home/app --api-key secret123
  SERVICE_API_KEY=secret123 excaliterm --hub-url https://hub.example.com
`);
  process.exit(0);
}

function parseCli() {
  const { values, positionals } = parseArgs({
    options: {
      "hub-url": { type: "string" },
      "api-key": { type: "string" },
      "workspace-id": { type: "string" },
      "service-id": { type: "string" },
      allow: { type: "string", multiple: true },
      shell: { type: "string" },
      help: { type: "boolean", short: "h" },
    },
    strict: true,
    allowPositionals: true,
  });

  if (values.help) printHelp();

  return { values, positionals };
}

export function loadConfig(): Config {
  const { values: cli, positionals } = parseCli();

  const apiKey = cli["api-key"] ?? process.env.SERVICE_API_KEY;
  if (!apiKey) {
    throw new Error(
      "SERVICE_API_KEY is required. Pass --api-key <key> or set the SERVICE_API_KEY environment variable.",
    );
  }

  const whitelistedPaths = [
    ...(process.env.WHITELISTED_PATHS ?? "").split(","),
    ...(cli.allow ?? []),
    ...positionals,
  ]
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
