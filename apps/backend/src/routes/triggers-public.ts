import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { eq } from "drizzle-orm";
import { getDb, schema } from "../db/index.js";
import { rateLimiter } from "../middleware/rate-limit.js";
import { parseTriggerConfig } from "../lib/mappers.js";
import { timingSafeEqualStr } from "../lib/timing-safe.js";
import { executeTriggerWithPrompt } from "../services/trigger-fire.js";
import { getLastOutputMs, isTerminalIdle } from "../services/terminal-activity.js";
import type { HttpTriggerConfig } from "@excaliterm/shared-types";

const triggersPublic = new Hono();

triggersPublic.post(
  "/:id/fire",
  rateLimiter({ max: 60, windowMs: 60_000 }),
  async (c) => {
    const triggerId = c.req.param("id");
    const db = getDb();

    const [row] = await db
      .select()
      .from(schema.trigger)
      .where(eq(schema.trigger.id, triggerId));

    if (!row || row.type !== "http") {
      throw new HTTPException(404, { message: "Trigger not found" });
    }

    const providedToken = c.req.header("x-trigger-token") ?? "";
    const config = parseTriggerConfig("http", row.config) as HttpTriggerConfig;
    if (!providedToken || !timingSafeEqualStr(providedToken, config.secret)) {
      throw new HTTPException(401, { message: "Invalid token" });
    }

    if (!row.enabled) {
      throw new HTTPException(403, { message: "Trigger is paused" });
    }

    // Optional caller-side idle gate — caller asks "only fire if the terminal
    // has been quiet for N seconds". If the terminal is still busy, return 409
    // so the caller can decide whether to retry.
    const requireIdleHeader = c.req.header("x-trigger-require-idle");
    const requireIdleSec = requireIdleHeader ? Math.max(1, Math.min(3600, Number(requireIdleHeader) || 0)) : 0;
    if (requireIdleSec > 0 && !isTerminalIdle(row.terminalSessionId, requireIdleSec)) {
      const lastOutputAt = new Date(getLastOutputMs(row.terminalSessionId)).toISOString();
      return c.json(
        { ok: false, error: "Terminal busy", lastOutputAt },
        409,
      );
    }

    const body = await c.req.json<{ prompt?: unknown }>().catch(() => ({} as { prompt?: unknown }));
    const prompt = typeof body.prompt === "string" ? body.prompt : "";
    if (!prompt.trim()) {
      throw new HTTPException(400, { message: "prompt is required" });
    }

    const result = await executeTriggerWithPrompt(triggerId, prompt);
    if (!result.ok) {
      throw new HTTPException(502, { message: result.error ?? "Failed to fire" });
    }

    return c.json({ ok: true, firedAt: result.firedAt.toISOString() });
  },
);

export { triggersPublic };
