import { getApiBaseUrl } from "@/lib/config";

export interface FireTriggerArgs {
  triggerId: string;
  triggerSecret: string;
  prompt: string;
}

export interface ReadTerminalArgs {
  terminalId: string;
  readToken: string;
  lines?: number;
}

export interface ReadTerminalResponse {
  terminalId: string;
  lines: string[];
  totalLines: number;
  capturedAt: string;
}

export class PublicPipeError extends Error {
  status: number;
  body: string;
  constructor(status: number, body: string, message: string) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

const apiBase = () => `${getApiBaseUrl()}/api`;

export async function fireTriggerPublic({
  triggerId,
  triggerSecret,
  prompt,
}: FireTriggerArgs): Promise<void> {
  const res = await fetch(`${apiBase()}/triggers/${triggerId}/fire`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Trigger-Token": triggerSecret,
    },
    body: JSON.stringify({ prompt }),
  });
  if (!res.ok) {
    const body = (await res.text().catch(() => "")).slice(0, 500);
    throw new PublicPipeError(
      res.status,
      body,
      `fire trigger ${triggerId} failed (${res.status})`,
    );
  }
}

export async function readTerminalPublic({
  terminalId,
  readToken,
  lines = 50,
}: ReadTerminalArgs): Promise<ReadTerminalResponse> {
  const res = await fetch(
    `${apiBase()}/terminals/${terminalId}/output?lines=${lines}`,
    { headers: { "X-Terminal-Read-Token": readToken } },
  );
  if (!res.ok) {
    const body = (await res.text().catch(() => "")).slice(0, 500);
    throw new PublicPipeError(
      res.status,
      body,
      `read terminal ${terminalId} failed (${res.status})`,
    );
  }
  return (await res.json()) as ReadTerminalResponse;
}
