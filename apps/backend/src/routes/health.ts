import { Hono } from "hono";
import { eq, count } from "drizzle-orm";
import { getDb, schema } from "../db/index.js";
import type { HealthResponse } from "@excaliterm/shared-types";

const health = new Hono();

health.get("/", async (c) => {
  const db = getDb();

  const [{ value: onlineCount }] = await db
    .select({ value: count() })
    .from(schema.serviceInstance)
    .where(eq(schema.serviceInstance.status, "online"));

  const response: HealthResponse = {
    status: "ok",
    serviceConnected: onlineCount > 0,
    connectedServices: onlineCount,
    timestamp: new Date().toISOString(),
  };
  return c.json(response);
});

export { health };
