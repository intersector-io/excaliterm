import os from "node:os";

export interface Config {
  signalrHubUrl: string;
  serviceApiKey: string;
  serviceId: string;
  tenantId: string;
  whitelistedPaths: string[];
  shell: string;
}

function detectShell(): string {
  if (process.platform === "win32") {
    // Prefer pwsh (PowerShell Core) if available, fallback to powershell.exe
    return "powershell.exe";
  }
  return process.env.SHELL || "/bin/bash";
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

  return {
    signalrHubUrl: process.env.SIGNALR_HUB_URL ?? "http://localhost:5000",
    serviceApiKey: apiKey,
    serviceId: process.env.SERVICE_ID ?? generateServiceId(),
    tenantId:
      process.env.TENANT_ID ?? "00000000-0000-0000-0000-000000000000",
    whitelistedPaths,
    shell: process.env.SHELL_OVERRIDE ?? detectShell(),
  };
}
