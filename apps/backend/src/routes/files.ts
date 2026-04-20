import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { eq, and } from "drizzle-orm";
import { getDb, schema } from "../db/index.js";
import type { WorkspaceVariables } from "../middleware/workspace.js";

const files = new Hono<{ Variables: WorkspaceVariables }>();

// GET /tree/:serviceId - Get directory listing (stub)
files.get("/tree/:serviceId", async (c) => {
  const workspaceId = c.get("workspaceId");
  const serviceId = c.req.param("serviceId");
  const db = getDb();

  const [service] = await db
    .select()
    .from(schema.serviceInstance)
    .where(
      and(
        eq(schema.serviceInstance.id, serviceId),
        eq(schema.serviceInstance.workspaceId, workspaceId),
      ),
    );

  if (!service) {
    throw new HTTPException(404, { message: "Service not found" });
  }

  return c.json({
    serviceId: service.serviceId,
    serviceName: service.name,
    tree: [],
    message: "File tree will be proxied via SignalR in a future update",
  });
});

export { files };
