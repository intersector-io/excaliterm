import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { getDb, schema } from "../db/index.js";
import type { HealthResponse } from "@terminal-proxy/shared-types";

const health = new Hono();

health.get("/", async (c) => {
  const db = getDb();

  // Count online services across all tenants (public endpoint)
  const onlineServices = await db
    .select()
    .from(schema.serviceInstance)
    .where(eq(schema.serviceInstance.status, "online"));

  const response: HealthResponse = {
    status: "ok",
    serviceConnected: onlineServices.length > 0,
    connectedServices: onlineServices.length,
    timestamp: new Date().toISOString(),
  };
  return c.json(response);
});

export { health };
