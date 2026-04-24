import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { eq, and } from "drizzle-orm";
import { getDb, schema } from "../db/index.js";
import { publish, setEx } from "../lib/redis.js";

// Tombstone TTL that covers a typical agent reconnect window. If a dismissed
// agent reconnects within this window, the hub will refuse its re-registration
// and force it to shut down.
const DISMISS_TOMBSTONE_TTL_SECONDS = 300;
import type { WorkspaceVariables } from "../middleware/workspace.js";

const services = new Hono<{ Variables: WorkspaceVariables }>();

function toServiceResponse(s: typeof schema.serviceInstance.$inferSelect) {
  return {
    id: s.id,
    serviceId: s.serviceId,
    name: s.name,
    whitelistedPaths: s.whitelistedPaths,
    status: s.status,
    lastSeen: s.lastSeen?.toISOString() ?? null,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  };
}

// GET / - List workspace's service instances
services.get("/", async (c) => {
  const workspaceId = c.get("workspaceId");
  const db = getDb();

  const rows = await db
    .select()
    .from(schema.serviceInstance)
    .where(eq(schema.serviceInstance.workspaceId, workspaceId));

  return c.json({ services: rows.map(toServiceResponse) });
});

// POST / - Register new service
services.post("/", async (c) => {
  const workspaceId = c.get("workspaceId");
  const body = await c.req.json<{ name: string; whitelistedPaths?: string }>();
  const db = getDb();

  if (!body.name) {
    throw new HTTPException(400, { message: "name is required" });
  }

  const id = crypto.randomUUID();
  const serviceId = crypto.randomUUID();
  const now = new Date();

  await db.insert(schema.serviceInstance).values({
    id,
    workspaceId,
    serviceId,
    name: body.name,
    apiKey: "",
    whitelistedPaths: body.whitelistedPaths ?? null,
    status: "offline",
    createdAt: now,
    updatedAt: now,
  });

  const [service] = await db
    .select()
    .from(schema.serviceInstance)
    .where(eq(schema.serviceInstance.id, id));

  return c.json({ service: toServiceResponse(service) }, 201);
});

// PATCH /:id - Update service
services.patch("/:id", async (c) => {
  const workspaceId = c.get("workspaceId");
  const serviceId = c.req.param("id");
  const db = getDb();

  const [existing] = await db
    .select()
    .from(schema.serviceInstance)
    .where(
      and(
        eq(schema.serviceInstance.id, serviceId),
        eq(schema.serviceInstance.workspaceId, workspaceId),
      ),
    );

  if (!existing) {
    throw new HTTPException(404, { message: "Service not found" });
  }

  const body = await c.req.json<{ name?: string; whitelistedPaths?: string }>();
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (body.name !== undefined) updates.name = body.name;
  if (body.whitelistedPaths !== undefined) updates.whitelistedPaths = body.whitelistedPaths;

  await db
    .update(schema.serviceInstance)
    .set(updates)
    .where(eq(schema.serviceInstance.id, serviceId));

  const [updated] = await db
    .select()
    .from(schema.serviceInstance)
    .where(eq(schema.serviceInstance.id, serviceId));

  return c.json({ service: toServiceResponse(updated) });
});

// DELETE /:id - Delete service
services.delete("/:id", async (c) => {
  const workspaceId = c.get("workspaceId");
  const serviceId = c.req.param("id");
  const db = getDb();

  const [existing] = await db
    .select()
    .from(schema.serviceInstance)
    .where(
      and(
        eq(schema.serviceInstance.id, serviceId),
        eq(schema.serviceInstance.workspaceId, workspaceId),
      ),
    );

  if (!existing) {
    throw new HTTPException(404, { message: "Service not found" });
  }

  // Collect canvas node IDs before deletion so we can broadcast their removal.
  const nodesToRemove = await db
    .select({ id: schema.canvasNode.id })
    .from(schema.canvasNode)
    .where(
      and(
        eq(schema.canvasNode.workspaceId, workspaceId),
        eq(schema.canvasNode.serviceInstanceId, serviceId),
      ),
    );

  await db
    .delete(schema.canvasNode)
    .where(
      and(
        eq(schema.canvasNode.workspaceId, workspaceId),
        eq(schema.canvasNode.serviceInstanceId, serviceId),
      ),
    );

  await db
    .delete(schema.serviceInstance)
    .where(eq(schema.serviceInstance.id, serviceId));

  // Broadcast removal to every connected client in the workspace via the hub.
  for (const node of nodesToRemove) {
    await publish("canvas:updates", {
      action: "nodeRemoved",
      workspaceId,
      userId: "system",
      nodeId: node.id,
    }).catch((err: Error) =>
      console.error("[redis] Failed to publish canvas:updates nodeRemoved:", err.message),
    );
  }

  // Set a tombstone before publishing so that if the agent reconnects between
  // our delete and its shutdown, the hub's RegisterService handler refuses the
  // re-registration and tells the agent to shut down.
  await setEx(
    `service:tombstone:${workspaceId}:${existing.serviceId}`,
    DISMISS_TOMBSTONE_TTL_SECONDS,
    "dismissed",
  ).catch((err: Error) =>
    console.error("[redis] Failed to set service tombstone:", err.message),
  );

  await publish("service:deleted", {
    serviceInstanceId: existing.serviceId,
    workspaceId,
    timestamp: Date.now(),
  }).catch((err: Error) =>
    console.error("[redis] Failed to publish service:deleted:", err.message),
  );

  return c.json({ success: true });
});

export { services };
