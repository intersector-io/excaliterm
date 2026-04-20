import { Hono } from "hono";
import { desc, eq } from "drizzle-orm";
import { getDb, schema } from "../db/index.js";
import type { WorkspaceVariables } from "../middleware/workspace.js";

const chat = new Hono<{ Variables: WorkspaceVariables }>();

// GET / - Get chat history for workspace (paginated)
chat.get("/", async (c) => {
  const workspaceId = c.get("workspaceId");
  const db = getDb();

  const limit = Math.min(Number(c.req.query("limit") || "50"), 100);
  const offset = Number(c.req.query("offset") || "0");

  const rows = await db
    .select()
    .from(schema.chatMessage)
    .where(eq(schema.chatMessage.workspaceId, workspaceId))
    .orderBy(desc(schema.chatMessage.createdAt))
    .limit(limit)
    .offset(offset);

  return c.json({
    messages: rows.map((m) => ({
      id: m.id,
      displayName: m.displayName,
      content: m.content,
      createdAt: m.createdAt.toISOString(),
    })),
    limit,
    offset,
  });
});

export { chat };
