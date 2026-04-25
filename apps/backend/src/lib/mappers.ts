import {
  TRIGGER_PROMPT_LANGUAGES,
  type CanvasNode,
  type CanvasEdge,
  type Trigger,
  type TriggerType,
  type TriggerConfig,
  type TimerTriggerConfig,
  type HttpTriggerConfig,
  type TriggerPromptLanguage,
} from "@excaliterm/shared-types";
import type { schema } from "../db/index.js";

export function toCanvasNodeResponse(
  row: typeof schema.canvasNode.$inferSelect,
): CanvasNode {
  return {
    id: row.id,
    terminalSessionId: row.terminalSessionId,
    nodeType: row.nodeType,
    noteId: row.noteId,
    screenshotId: row.screenshotId,
    serviceInstanceId: row.serviceInstanceId,
    triggerId: row.triggerId,
    x: row.x,
    y: row.y,
    width: row.width,
    height: row.height,
    zIndex: row.zIndex,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toCanvasEdgeResponse(
  row: typeof schema.canvasEdge.$inferSelect,
): CanvasEdge {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    sourceNodeId: row.sourceNodeId,
    targetNodeId: row.targetNodeId,
    createdAt: row.createdAt.toISOString(),
  };
}

const TIMER_DEFAULTS: TimerTriggerConfig = { intervalMin: 5, prompt: "", language: "shell" };

function normalizeLanguage(v: unknown): TriggerPromptLanguage {
  return typeof v === "string" && (TRIGGER_PROMPT_LANGUAGES as readonly string[]).includes(v)
    ? (v as TriggerPromptLanguage)
    : "shell";
}

function parseTimerConfig(parsed: Partial<TimerTriggerConfig>): TimerTriggerConfig {
  const intervalMin = Math.max(1, Math.min(1440, Math.floor(parsed.intervalMin ?? TIMER_DEFAULTS.intervalMin)));
  const prompt = typeof parsed.prompt === "string" ? parsed.prompt : "";
  const result: TimerTriggerConfig = {
    intervalMin,
    prompt,
    language: normalizeLanguage(parsed.language),
  };
  if (typeof parsed.requireIdleSec === "number" && parsed.requireIdleSec > 0) {
    result.requireIdleSec = Math.max(1, Math.min(3600, Math.floor(parsed.requireIdleSec)));
  }
  return result;
}

function parseHttpConfig(parsed: Partial<HttpTriggerConfig>): HttpTriggerConfig {
  const secret = typeof parsed.secret === "string" && parsed.secret.length > 0
    ? parsed.secret
    : crypto.randomUUID();
  return { secret };
}

export function parseTriggerConfig(type: TriggerType, raw: string | null | undefined): TriggerConfig {
  let parsed: Record<string, unknown> = {};
  if (raw) {
    try {
      parsed = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      parsed = {};
    }
  }
  if (type === "http") return parseHttpConfig(parsed as Partial<HttpTriggerConfig>);
  return parseTimerConfig(parsed as Partial<TimerTriggerConfig>);
}

export function serializeTriggerConfig(type: TriggerType, cfg: Partial<TriggerConfig>): string {
  if (type === "http") {
    return JSON.stringify(parseHttpConfig(cfg as Partial<HttpTriggerConfig>));
  }
  return JSON.stringify(parseTimerConfig(cfg as Partial<TimerTriggerConfig>));
}

export function toTriggerResponse(
  row: typeof schema.trigger.$inferSelect,
): Trigger {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    terminalNodeId: row.terminalNodeId,
    terminalSessionId: row.terminalSessionId,
    type: row.type,
    enabled: row.enabled,
    config: parseTriggerConfig(row.type, row.config),
    lastFiredAt: row.lastFiredAt ? row.lastFiredAt.toISOString() : null,
    lastError: row.lastError ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
