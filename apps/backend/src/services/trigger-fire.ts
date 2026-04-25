import { eq } from "drizzle-orm";
import { getDb, schema } from "../db/index.js";
import { publish } from "../lib/redis.js";

export interface FireResult {
  ok: boolean;
  error: string | null;
  firedAt: Date;
}

export async function executeTriggerWithPrompt(
  triggerId: string,
  prompt: string,
): Promise<FireResult> {
  const db = getDb();
  const [row] = await db
    .select({
      trigger: schema.trigger,
      terminalStatus: schema.terminalSession.status,
      serviceId: schema.serviceInstance.serviceId,
    })
    .from(schema.trigger)
    .leftJoin(
      schema.terminalSession,
      eq(schema.trigger.terminalSessionId, schema.terminalSession.id),
    )
    .leftJoin(
      schema.serviceInstance,
      eq(schema.terminalSession.serviceInstanceId, schema.serviceInstance.id),
    )
    .where(eq(schema.trigger.id, triggerId));

  const firedAt = new Date();
  if (!row) return { ok: false, error: "Trigger not found", firedAt };

  const trigger = row.trigger;
  let ok = true;
  let error: string | null = null;

  if (!row.terminalStatus || row.terminalStatus !== "active") {
    ok = false;
    error = "Terminal is not active";
  } else if (!prompt.trim()) {
    ok = false;
    error = "Prompt is empty";
  } else {
    try {
      const data = prompt.endsWith("\r") ? prompt : prompt + "\r";
      await publish("terminal:commands", {
        command: "terminal:write",
        terminalId: trigger.terminalSessionId,
        serviceInstanceId: row.serviceId,
        workspaceId: trigger.workspaceId,
        data,
      });
    } catch (err) {
      ok = false;
      error = err instanceof Error ? err.message : String(err);
    }
  }

  await Promise.all([
    db
      .update(schema.trigger)
      .set({ lastFiredAt: firedAt, lastError: ok ? null : error, updatedAt: new Date() })
      .where(eq(schema.trigger.id, triggerId)),
    publish("trigger:fired", {
      triggerId,
      terminalNodeId: trigger.terminalNodeId,
      terminalSessionId: trigger.terminalSessionId,
      workspaceId: trigger.workspaceId,
      firedAt: firedAt.getTime(),
      ok,
      error,
    }).catch((err) => console.error("[trigger-fire] publish failed:", err)),
  ]);

  return { ok, error, firedAt };
}
