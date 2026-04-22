import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { eq } from "drizzle-orm";
import { getDb, schema } from "../db/index.js";

const workspaces = new Hono();

function generateId(length = 12): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

function toWorkspaceResponse(ws: typeof schema.workspace.$inferSelect) {
  return {
    id: ws.id,
    name: ws.name,
    apiKey: ws.apiKey,
    createdAt: ws.createdAt.toISOString(),
    lastAccessedAt: ws.lastAccessedAt.toISOString(),
  };
}

// POST /api/workspaces - Create a new workspace
workspaces.post("/", async (c) => {
  const db = getDb();
  const id = generateId();
  const now = new Date();

  await db.insert(schema.workspace).values({
    id,
    name: "Untitled workspace",
    apiKey: crypto.randomUUID(),
    createdAt: now,
    lastAccessedAt: now,
  });

  const [workspace] = await db
    .select()
    .from(schema.workspace)
    .where(eq(schema.workspace.id, id));

  return c.json(toWorkspaceResponse(workspace), 201);
});

// GET /api/workspaces/:id - Get workspace info
workspaces.get("/:id", async (c) => {
  const id = c.req.param("id");
  const db = getDb();

  const [workspace] = await db
    .select()
    .from(schema.workspace)
    .where(eq(schema.workspace.id, id));

  if (!workspace) {
    throw new HTTPException(404, { message: "Workspace not found" });
  }

  await db
    .update(schema.workspace)
    .set({ lastAccessedAt: new Date() })
    .where(eq(schema.workspace.id, id));

  return c.json(toWorkspaceResponse(workspace));
});

export { workspaces };
