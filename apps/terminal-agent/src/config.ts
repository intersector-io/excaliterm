import os from "node:os";

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

export function loadConfig(): Config {
  const apiKey = process.env.SERVICE_API_KEY;
  if (!apiKey) {
    throw new Error(
      "SERVICE_API_KEY environment variable is required. Set it in your .env file or environment."
    );
  }

  const whitelistedRaw = process.env.WHITELISTED_PATHS ?? "";
  const whitelistedPaths = whitelistedRaw
    .split(",")
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  const shellOverride = process.env.SHELL_OVERRIDE?.trim();
  const detectedShell = detectShell();

  return {
    signalrHubUrl: process.env.SIGNALR_HUB_URL ?? "http://localhost:5000",
    serviceApiKey: apiKey,
    serviceId: process.env.SERVICE_ID ?? generateServiceId(),
    workspaceId:
      process.env.WORKSPACE_ID ?? "00000000-0000-0000-0000-000000000000",
    whitelistedPaths,
    shell: shellOverride && shellOverride.length > 0 ? shellOverride : detectedShell.shell,
    shellArgs: shellOverride && shellOverride.length > 0 ? [] : detectedShell.shellArgs,
  };
}
