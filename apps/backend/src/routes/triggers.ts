import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { eq, and } from "drizzle-orm";
import { getDb, schema } from "../db/index.js";
import {
  TRIGGER_TYPES,
  type CreateTriggerRequest,
  type CreateTriggerResponse,
  type UpdateTriggerRequest,
  type ListTriggersResponse,
  type TriggerResponse,
  type TriggerType,
  type TimerTriggerConfig,
  type HttpTriggerConfig,
} from "@excaliterm/shared-types";
import type { WorkspaceVariables } from "../middleware/workspace.js";
import {
  toCanvasNodeResponse,
  toCanvasEdgeResponse,
  toTriggerResponse,
  parseTriggerConfig,
  serializeTriggerConfig,
} from "../lib/mappers.js";
import {
  rescheduleTimerTrigger,
  unscheduleTrigger,
  fireTimerTriggerNow,
} from "../services/trigger-scheduler.js";

const triggers = new Hono<{ Variables: WorkspaceVariables }>();

function defaultSizeFor(type: TriggerType): { width: number; height: number } {
  if (type === "http") return { width: 340, height: 260 };
  return { width: 300, height: 280 };
}

triggers.get("/", async (c) => {
  const workspaceId = c.get("workspaceId");
  const db = getDb();

  const rows = await db
    .select()
    .from(schema.trigger)
    .where(eq(schema.trigger.workspaceId, workspaceId));

  const response: ListTriggersResponse = {
    triggers: rows.map(toTriggerResponse),
  };
  return c.json(response);
});

triggers.post("/", async (c) => {
  const workspaceId = c.get("workspaceId");
  const db = getDb();
  const body = await c.req.json<CreateTriggerRequest>();

  if (!body.terminalNodeId) {
    throw new HTTPException(400, { message: "terminalNodeId is required" });
  }
  if (!(TRIGGER_TYPES as readonly string[]).includes(body.type)) {
    throw new HTTPException(400, { message: "Unsupported trigger type" });
  }

  const [terminalNode] = await db
    .select()
    .from(schema.canvasNode)
    .where(
      and(
        eq(schema.canvasNode.id, body.terminalNodeId),
        eq(schema.canvasNode.workspaceId, workspaceId),
      ),
    );

  if (!terminalNode || terminalNode.nodeType !== "terminal" || !terminalNode.terminalSessionId) {
    throw new HTTPException(404, { message: "Terminal node not found" });
  }

  const [duplicate] = await db
    .select({ id: schema.trigger.id })
    .from(schema.trigger)
    .where(
      and(
        eq(schema.trigger.terminalNodeId, body.terminalNodeId),
        eq(schema.trigger.type, body.type),
      ),
    );
  if (duplicate) {
    throw new HTTPException(409, {
      message: `A ${body.type} trigger already exists for this terminal`,
    });
  }

  const triggerId = crypto.randomUUID();
  const triggerNodeId = crypto.randomUUID();
  const edgeId = crypto.randomUUID();
  const now = new Date();
  const size = defaultSizeFor(body.type);

  // Build the type-specific config, applying defaults via the mapper.
  const initialConfig =
    body.type === "http"
      ? ({ secret: crypto.randomUUID() } satisfies HttpTriggerConfig)
      : ({
          intervalMin: (body.config as Partial<TimerTriggerConfig>)?.intervalMin ?? 5,
          prompt: (body.config as Partial<TimerTriggerConfig>)?.prompt ?? "",
          language: (body.config as Partial<TimerTriggerConfig>)?.language ?? "shell",
        } satisfies TimerTriggerConfig);

  const x = terminalNode.x + terminalNode.width + 60;
  const y = terminalNode.y + Math.max(0, terminalNode.height - size.height) / 2;

  const triggerRow = {
    id: triggerId,
    workspaceId,
    terminalNodeId: body.terminalNodeId,
    terminalSessionId: terminalNode.terminalSessionId,
    type: body.type,
    enabled: false,
    config: serializeTriggerConfig(body.type, initialConfig),
    lastFiredAt: null,
    lastError: null,
    createdAt: now,
    updatedAt: now,
  } as const;

  const nodeRow = {
    id: triggerNodeId,
    workspaceId,
    terminalSessionId: null,
    nodeType: "trigger",
    noteId: null,
    screenshotId: null,
    serviceInstanceId: null,
    triggerId,
    x,
    y,
    width: size.width,
    height: size.height,
    zIndex: 0,
    createdAt: now,
    updatedAt: now,
  } as const;

  const edgeRow = {
    id: edgeId,
    workspaceId,
    sourceNodeId: body.terminalNodeId,
    targetNodeId: triggerNodeId,
    createdAt: now,
  } as const;

  await db.transaction(async (tx) => {
    await tx.insert(schema.canvasNode).values(nodeRow);
    await tx.insert(schema.trigger).values(triggerRow);
    await tx.insert(schema.canvasEdge).values(edgeRow);
  });

  const response: CreateTriggerResponse = {
    trigger: toTriggerResponse(triggerRow),
    canvasNode: toCanvasNodeResponse(nodeRow),
    canvasEdge: toCanvasEdgeResponse(edgeRow),
  };
  return c.json(response, 201);
});

triggers.patch("/:id", async (c) => {
  const workspaceId = c.get("workspaceId");
  const triggerId = c.req.param("id");
  const db = getDb();
  const body = await c.req.json<UpdateTriggerRequest>();

  const [existing] = await db
    .select()
    .from(schema.trigger)
    .where(
      and(
        eq(schema.trigger.id, triggerId),
        eq(schema.trigger.workspaceId, workspaceId),
      ),
    );
  if (!existing) {
    throw new HTTPException(404, { message: "Trigger not found" });
  }

  const currentConfig = parseTriggerConfig(existing.type, existing.config);
  const nextEnabled = body.enabled ?? existing.enabled;

  let nextConfigSerialized = existing.config;
  let nextIntervalMin = 0;

  if (existing.type === "timer") {
    const partial = (body.config ?? {}) as Partial<TimerTriggerConfig>;
    const cur = currentConfig as TimerTriggerConfig;
    const merged: TimerTriggerConfig = {
      intervalMin: partial.intervalMin ?? cur.intervalMin,
      prompt: partial.prompt ?? cur.prompt,
      language: partial.language ?? cur.language,
    };
    if (nextEnabled && !merged.prompt.trim()) {
      throw new HTTPException(400, { message: "Cannot enable trigger with empty prompt" });
    }
    nextConfigSerialized = serializeTriggerConfig("timer", merged);
    nextIntervalMin = merged.intervalMin;
  }
  // HTTP triggers ignore config changes from PATCH (rotate is a separate route).

  await db
    .update(schema.trigger)
    .set({
      enabled: nextEnabled,
      config: nextConfigSerialized,
      updatedAt: new Date(),
    })
    .where(eq(schema.trigger.id, triggerId));

  const [updated] = await db.select().from(schema.trigger).where(eq(schema.trigger.id, triggerId));

  if (existing.type === "timer") {
    rescheduleTimerTrigger(triggerId, updated.enabled, nextIntervalMin, updated.lastFiredAt);
  }

  const response: TriggerResponse = { trigger: toTriggerResponse(updated) };
  return c.json(response);
});

// POST /:id/rotate — generate a new secret for an HTTP trigger
triggers.post("/:id/rotate", async (c) => {
  const workspaceId = c.get("workspaceId");
  const triggerId = c.req.param("id");
  const db = getDb();

  const [existing] = await db
    .select()
    .from(schema.trigger)
    .where(
      and(
        eq(schema.trigger.id, triggerId),
        eq(schema.trigger.workspaceId, workspaceId),
      ),
    );
  if (!existing) {
    throw new HTTPException(404, { message: "Trigger not found" });
  }
  if (existing.type !== "http") {
    throw new HTTPException(400, { message: "Only HTTP triggers can rotate secrets" });
  }

  const newConfig: HttpTriggerConfig = { secret: crypto.randomUUID() };
  await db
    .update(schema.trigger)
    .set({
      config: serializeTriggerConfig("http", newConfig),
      updatedAt: new Date(),
    })
    .where(eq(schema.trigger.id, triggerId));

  const [updated] = await db.select().from(schema.trigger).where(eq(schema.trigger.id, triggerId));
  const response: TriggerResponse = { trigger: toTriggerResponse(updated) };
  return c.json(response);
});

triggers.delete("/:id", async (c) => {
  const workspaceId = c.get("workspaceId");
  const triggerId = c.req.param("id");
  const db = getDb();

  const [existing] = await db
    .select()
    .from(schema.trigger)
    .where(
      and(
        eq(schema.trigger.id, triggerId),
        eq(schema.trigger.workspaceId, workspaceId),
      ),
    );
  if (!existing) {
    throw new HTTPException(404, { message: "Trigger not found" });
  }

  unscheduleTrigger(triggerId);

  await db
    .delete(schema.canvasNode)
    .where(
      and(
        eq(schema.canvasNode.workspaceId, workspaceId),
        eq(schema.canvasNode.triggerId, triggerId),
      ),
    );

  await db
    .delete(schema.trigger)
    .where(eq(schema.trigger.id, triggerId));

  return c.json({ success: true });
});

// POST /:id/fire — manual fire (timer triggers only; HTTP uses the public endpoint)
triggers.post("/:id/fire", async (c) => {
  const workspaceId = c.get("workspaceId");
  const triggerId = c.req.param("id");
  const db = getDb();

  const [existing] = await db
    .select()
    .from(schema.trigger)
    .where(
      and(
        eq(schema.trigger.id, triggerId),
        eq(schema.trigger.workspaceId, workspaceId),
      ),
    );
  if (!existing) {
    throw new HTTPException(404, { message: "Trigger not found" });
  }
  if (existing.type !== "timer") {
    throw new HTTPException(400, { message: "HTTP triggers fire via the public endpoint" });
  }

  await fireTimerTriggerNow(triggerId);
  return c.json({ success: true });
});

export { triggers };
