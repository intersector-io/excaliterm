import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { eq, and } from "drizzle-orm";
import { getDb, schema } from "../db/index.js";
import type {
  UpdateCanvasNodeRequest,
  ListCanvasNodesResponse,
  CanvasNode,
} from "@terminal-proxy/shared-types";
import type { WorkspaceVariables } from "../middleware/workspace.js";

const canvas = new Hono<{ Variables: WorkspaceVariables }>();

function toCanvasNodeResponse(
  row: typeof schema.canvasNode.$inferSelect,
): CanvasNode {
  return {
    id: row.id,
    terminalSessionId: row.terminalSessionId,
    nodeType: row.nodeType,
    noteId: row.noteId,
    x: row.x,
    y: row.y,
    width: row.width,
    height: row.height,
    zIndex: row.zIndex,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// GET /nodes - List ALL workspace's canvas nodes
canvas.get("/nodes", async (c) => {
  const workspaceId = c.get("workspaceId");
  const db = getDb();

  const rows = await db
    .select()
    .from(schema.canvasNode)
    .where(eq(schema.canvasNode.workspaceId, workspaceId));

  const response: ListCanvasNodesResponse = {
    nodes: rows.map((r) => toCanvasNodeResponse(r)),
  };

  return c.json(response);
});

// PATCH /nodes/:id - Update node position/size
canvas.patch("/nodes/:id", async (c) => {
  const workspaceId = c.get("workspaceId");
  const nodeId = c.req.param("id");
  const db = getDb();

  const [existing] = await db
    .select()
    .from(schema.canvasNode)
    .where(
      and(
        eq(schema.canvasNode.id, nodeId),
        eq(schema.canvasNode.workspaceId, workspaceId),
      ),
    );

  if (!existing) {
    throw new HTTPException(404, { message: "Canvas node not found" });
  }

  const body = await c.req.json<UpdateCanvasNodeRequest>();

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (body.x !== undefined) updates.x = body.x;
  if (body.y !== undefined) updates.y = body.y;
  if (body.width !== undefined) updates.width = body.width;
  if (body.height !== undefined) updates.height = body.height;
  if (body.zIndex !== undefined) updates.zIndex = body.zIndex;

  await db
    .update(schema.canvasNode)
    .set(updates)
    .where(eq(schema.canvasNode.id, nodeId));

  const [updated] = await db
    .select()
    .from(schema.canvasNode)
    .where(eq(schema.canvasNode.id, nodeId));

  return c.json({ node: toCanvasNodeResponse(updated) });
});

// DELETE /nodes/:id - Delete a canvas node
canvas.delete("/nodes/:id", async (c) => {
  const workspaceId = c.get("workspaceId");
  const nodeId = c.req.param("id");
  const db = getDb();

  const [existing] = await db
    .select()
    .from(schema.canvasNode)
    .where(
      and(
        eq(schema.canvasNode.id, nodeId),
        eq(schema.canvasNode.workspaceId, workspaceId),
      ),
    );

  if (!existing) {
    throw new HTTPException(404, { message: "Canvas node not found" });
  }

  await db
    .delete(schema.canvasNode)
    .where(eq(schema.canvasNode.id, nodeId));

  return c.json({ success: true });
});

export { canvas };
