import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { eq } from "drizzle-orm";
import { getDb, schema } from "../db/index.js";
import { rateLimiter } from "../middleware/rate-limit.js";

const workspaces = new Hono();

function generateId(length = 12): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

type Workspace = typeof schema.workspace.$inferSelect;

// Returned only on creation — the apiKey is secret and must never be handed out again.
function toWorkspaceCreateResponse(ws: Workspace) {
  return {
    id: ws.id,
    name: ws.name,
    apiKey: ws.apiKey,
    createdAt: ws.createdAt.toISOString(),
    lastAccessedAt: ws.lastAccessedAt.toISOString(),
  };
}

function toWorkspacePublicResponse(ws: Workspace) {
  return {
    id: ws.id,
    name: ws.name,
    createdAt: ws.createdAt.toISOString(),
    lastAccessedAt: ws.lastAccessedAt.toISOString(),
  };
}

// POST /api/workspaces - Create a new workspace (strict per-IP quota)
workspaces.post(
  "/",
  rateLimiter({ max: 5, windowMs: 60 * 60_000 }),
  async (c) => {
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

    return c.json(toWorkspaceCreateResponse(workspace), 201);
  },
);

// GET /api/workspaces/:id - Get workspace info (no secrets)
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

  return c.json(toWorkspacePublicResponse(workspace));
});

export { workspaces };
