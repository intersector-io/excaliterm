import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { eq } from "drizzle-orm";
import { getDb, schema } from "../db/index.js";

export type WorkspaceVariables = {
  workspaceId: string;
};

export const workspaceMiddleware = createMiddleware<{
  Variables: WorkspaceVariables;
}>(async (c, next) => {
  const workspaceId = c.req.param("workspaceId");

  if (!workspaceId) {
    throw new HTTPException(400, { message: "Workspace ID is required" });
  }

  const db = getDb();
  const [workspace] = await db
    .select()
    .from(schema.workspace)
    .where(eq(schema.workspace.id, workspaceId));

  if (!workspace) {
    throw new HTTPException(404, { message: "Workspace not found" });
  }

  // Update last accessed timestamp
  await db
    .update(schema.workspace)
    .set({ lastAccessedAt: new Date() })
    .where(eq(schema.workspace.id, workspaceId));

  c.set("workspaceId", workspaceId);
  await next();
});
