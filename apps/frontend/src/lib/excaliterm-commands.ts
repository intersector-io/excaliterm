export const INSTALL_CMD = "npm install -g excaliterm";

interface CommandParams {
  hubUrl: string;
  workspaceId: string;
  apiKey: string;
  serviceId?: string;
}

export function buildRunCommand({ hubUrl, workspaceId, apiKey, serviceId }: CommandParams): string {
  const parts = [
    "excaliterm",
    `--hub-url ${hubUrl}`,
    `--workspace-id ${workspaceId}`,
  ];
  if (serviceId) {
    parts.push(`--service-id ${serviceId}`);
  }
  parts.push(`--api-key ${apiKey}`);
  return parts.join(" ");
}

export function buildEnvFile({ hubUrl, workspaceId, apiKey, serviceId }: CommandParams): string {
  const lines = [
    `SIGNALR_HUB_URL=${hubUrl}`,
    `WORKSPACE_ID=${workspaceId}`,
  ];
  if (serviceId) {
    lines.push(`SERVICE_ID=${serviceId}`);
  }
  lines.push(`SERVICE_API_KEY=${apiKey}`);
  return lines.join("\n");
}
