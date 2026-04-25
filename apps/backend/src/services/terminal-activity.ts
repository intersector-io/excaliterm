import { subscribe } from "../lib/redis.js";

const lastOutputMs = new Map<string, number>();

export async function initTerminalActivityTracking() {
  await subscribe("terminal:activity", (raw) => {
    try {
      const evt = JSON.parse(raw) as { terminalId?: string; ts?: number };
      if (typeof evt.terminalId !== "string" || typeof evt.ts !== "number") return;
      const prev = lastOutputMs.get(evt.terminalId) ?? 0;
      if (evt.ts > prev) lastOutputMs.set(evt.terminalId, evt.ts);
    } catch {
      // malformed payload — ignore
    }
  });
}

export function getLastOutputMs(terminalId: string): number {
  return lastOutputMs.get(terminalId) ?? 0;
}

export function isTerminalIdle(terminalId: string, idleSec: number): boolean {
  if (idleSec <= 0) return true;
  const last = getLastOutputMs(terminalId);
  if (last === 0) return true; // no output ever recorded — treat as idle
  return Date.now() - last >= idleSec * 1000;
}
