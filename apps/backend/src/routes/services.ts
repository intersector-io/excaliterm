import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { v4 as uuidv4 } from "uuid";
import { eq, and } from "drizzle-orm";
import { getDb, schema } from "../db/index.js";
import type { WorkspaceVariables } from "../middleware/workspace.js";

const services = new Hono<{ Variables: WorkspaceVariables }>();

// GET / - List workspace's service instances
services.get("/", async (c) => {
  const workspaceId = c.get("workspaceId");
  const db = getDb();

  const rows = await db
    .select()
    .from(schema.serviceInstance)
    .where(eq(schema.serviceInstance.workspaceId, workspaceId));

  return c.json({
    services: rows.map((s) => ({
      id: s.id,
      serviceId: s.serviceId,
      name: s.name,
      whitelistedPaths: s.whitelistedPaths,
      status: s.status,
      lastSeen: s.lastSeen?.toISOString() ?? null,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    })),
  });
});

// POST / - Register new service
services.post("/", async (c) => {
  const workspaceId = c.get("workspaceId");
  const body = await c.req.json<{ name: string; whitelistedPaths?: string }>();
  const db = getDb();

  if (!body.name) {
    throw new HTTPException(400, { message: "name is required" });
  }

  const id = uuidv4();
  const serviceId = uuidv4();
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

  return c.json(
    {
      service: {
        id: service.id,
        serviceId: service.serviceId,
        name: service.name,
        whitelistedPaths: service.whitelistedPaths,
        status: service.status,
        lastSeen: service.lastSeen?.toISOString() ?? null,
        createdAt: service.createdAt.toISOString(),
        updatedAt: service.updatedAt.toISOString(),
      },
    },
    201,
  );
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

  return c.json({
    service: {
      id: updated.id,
      serviceId: updated.serviceId,
      name: updated.name,
      whitelistedPaths: updated.whitelistedPaths,
      status: updated.status,
      lastSeen: updated.lastSeen?.toISOString() ?? null,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    },
  });
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

  // Delete host and editor canvas nodes for this service
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

  return c.json({ success: true });
});

export { services };
