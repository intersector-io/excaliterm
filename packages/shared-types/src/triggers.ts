// ─── Triggers ────────────────────────────────────────────────────────────────

export const TRIGGER_TYPES = ["timer", "http"] as const;
export type TriggerType = typeof TRIGGER_TYPES[number];

export const TRIGGER_PROMPT_LANGUAGES = ["shell", "powershell", "bash", "sql", "plaintext"] as const;
export type TriggerPromptLanguage = typeof TRIGGER_PROMPT_LANGUAGES[number];

export interface TimerTriggerConfig {
  intervalMin: number;
  prompt: string;
  language?: TriggerPromptLanguage;
  /**
   * If set, the timer skips a firing window when the terminal has produced
   * output within the last N seconds. Useful for agentic loops (e.g. Ralph
   * loop) where the trigger should only nudge when the agent is idle.
   * Range: 1–3600. Omit/0 to disable.
   */
  requireIdleSec?: number;
}

export interface HttpTriggerConfig {
  secret: string;
}

export type TriggerConfig = TimerTriggerConfig | HttpTriggerConfig;

export interface Trigger {
  id: string;
  workspaceId: string;
  terminalNodeId: string;
  terminalSessionId: string;
  type: TriggerType;
  enabled: boolean;
  config: TriggerConfig;
  lastFiredAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTriggerRequest {
  terminalNodeId: string;
  type: TriggerType;
  config?: Partial<TimerTriggerConfig> | Partial<HttpTriggerConfig>;
}

export interface UpdateTriggerRequest {
  enabled?: boolean;
  config?: Partial<TimerTriggerConfig> | Partial<HttpTriggerConfig>;
}

export interface CreateTriggerResponse {
  trigger: Trigger;
  canvasNode: import("./models.js").CanvasNode;
  canvasEdge: import("./models.js").CanvasEdge;
}

export interface TriggerResponse {
  trigger: Trigger;
}

export interface ListTriggersResponse {
  triggers: Trigger[];
}

// ─── SignalR (CanvasHub) — server → client ───────────────────────────────────

export interface TriggerFiredEvent {
  triggerId: string;
  terminalNodeId: string;
  terminalSessionId: string;
  firedAt: number;
  ok: boolean;
  error?: string;
}
