import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { eq, and, count } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { getDb, schema } from "../db/index.js";
import type {
  UpdateCanvasNodeRequest,
  ListCanvasNodesResponse,
  CreateScreenshotRequest,
  CreateScreenshotResponse,
  CreateEditorNodeRequest,
  CreateEditorNodeResponse,
  ListCanvasEdgesResponse,
  CanvasNode,
  CanvasEdge,
} from "@excaliterm/shared-types";
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
    screenshotId: row.screenshotId,
    serviceInstanceId: row.serviceInstanceId,
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

// ─── Screenshots ────────────────────────────────────────────────────────────

// GET /screenshots - List all screenshots for the workspace
canvas.get("/screenshots", async (c) => {
  const workspaceId = c.get("workspaceId");
  const db = getDb();

  const rows = await db
    .select()
    .from(schema.screenshot)
    .where(eq(schema.screenshot.workspaceId, workspaceId));

  return c.json({
    screenshots: rows.map((r) => ({
      id: r.id,
      workspaceId: r.workspaceId,
      serviceInstanceId: r.serviceInstanceId ?? "",
      imageData: r.imageData,
      monitorIndex: r.monitorIndex,
      width: r.width,
      height: r.height,
      capturedAt: r.capturedAt.toISOString(),
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    })),
  });
});

// POST /screenshots - Create screenshot + canvas node + edge
canvas.post("/screenshots", async (c) => {
  const workspaceId = c.get("workspaceId");
  const db = getDb();
  const body = await c.req.json<CreateScreenshotRequest>();

  const screenshotId = crypto.randomUUID();
  const nodeId = crypto.randomUUID();
  const edgeId = crypto.randomUUID();

  // Verify the source terminal node exists
  const [sourceNode] = await db
    .select()
    .from(schema.canvasNode)
    .where(
      and(
        eq(schema.canvasNode.id, body.sourceTerminalNodeId),
        eq(schema.canvasNode.workspaceId, workspaceId),
      ),
    );

  if (!sourceNode) {
    throw new HTTPException(404, { message: "Source terminal node not found" });
  }

  // Position the screenshot node below and to the right of the source
  const x = body.x ?? sourceNode.x + 100;
  const y = body.y ?? sourceNode.y + sourceNode.height + 60;

  // Create screenshot record
  await db.insert(schema.screenshot).values({
    id: screenshotId,
    workspaceId,
    serviceInstanceId: body.serviceInstanceId,
    imageData: body.imageData,
    monitorIndex: body.monitorIndex,
    width: body.width,
    height: body.height,
  });

  // Create canvas node for the screenshot
  await db.insert(schema.canvasNode).values({
    id: nodeId,
    workspaceId,
    nodeType: "screenshot",
    screenshotId,
    x,
    y,
    width: Math.min(body.width, 800),
    height: Math.min(body.height, 600),
  });

  // Create edge connecting source terminal to screenshot
  await db.insert(schema.canvasEdge).values({
    id: edgeId,
    workspaceId,
    sourceNodeId: body.sourceTerminalNodeId,
    targetNodeId: nodeId,
  });

  const [newNode] = await db
    .select()
    .from(schema.canvasNode)
    .where(eq(schema.canvasNode.id, nodeId));

  const [newScreenshot] = await db
    .select()
    .from(schema.screenshot)
    .where(eq(schema.screenshot.id, screenshotId));

  const response: CreateScreenshotResponse = {
    screenshot: {
      id: newScreenshot.id,
      workspaceId: newScreenshot.workspaceId,
      serviceInstanceId: newScreenshot.serviceInstanceId ?? "",
      imageData: newScreenshot.imageData,
      monitorIndex: newScreenshot.monitorIndex,
      width: newScreenshot.width,
      height: newScreenshot.height,
      capturedAt: newScreenshot.capturedAt.toISOString(),
      createdAt: newScreenshot.createdAt.toISOString(),
      updatedAt: newScreenshot.updatedAt.toISOString(),
    },
    canvasNode: toCanvasNodeResponse(newNode),
    canvasEdge: {
      id: edgeId,
      workspaceId,
      sourceNodeId: body.sourceTerminalNodeId,
      targetNodeId: nodeId,
      createdAt: new Date().toISOString(),
    },
  };

  return c.json(response, 201);
});

// ─── Editor Nodes ──────────────────────────────────────────────────────────

// POST /editors - Create an editor node connected to a host node
canvas.post("/editors", async (c) => {
  const workspaceId = c.get("workspaceId");
  const db = getDb();
  const body = await c.req.json<CreateEditorNodeRequest>();

  if (!body.serviceInstanceId) {
    throw new HTTPException(400, { message: "serviceInstanceId is required" });
  }

  // Validate service belongs to workspace and is online
  const [service] = await db
    .select()
    .from(schema.serviceInstance)
    .where(
      and(
        eq(schema.serviceInstance.id, body.serviceInstanceId),
        eq(schema.serviceInstance.workspaceId, workspaceId),
      ),
    );

  if (!service) {
    throw new HTTPException(404, { message: "Service not found" });
  }

  // Find the host node for this service
  const [hostNode] = await db
    .select()
    .from(schema.canvasNode)
    .where(
      and(
        eq(schema.canvasNode.workspaceId, workspaceId),
        eq(schema.canvasNode.nodeType, "host"),
        eq(schema.canvasNode.serviceInstanceId, body.serviceInstanceId),
      ),
    );

  if (!hostNode) {
    throw new HTTPException(400, { message: "Host node not found for this service" });
  }

  // Position beside the host node
  const [{ value: existingCount }] = await db
    .select({ value: count() })
    .from(schema.canvasNode)
    .where(eq(schema.canvasNode.workspaceId, workspaceId));

  const x = body.x ?? hostNode.x + hostNode.width + 60;
  const y = body.y ?? hostNode.y;

  const nodeId = uuidv4();
  const edgeId = uuidv4();
  const now = new Date();

  await db.insert(schema.canvasNode).values({
    id: nodeId,
    workspaceId,
    nodeType: "editor",
    serviceInstanceId: body.serviceInstanceId,
    x,
    y,
    width: 760,
    height: 520,
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(schema.canvasEdge).values({
    id: edgeId,
    workspaceId,
    sourceNodeId: nodeId,
    targetNodeId: hostNode.id,
  });

  const [newNode] = await db
    .select()
    .from(schema.canvasNode)
    .where(eq(schema.canvasNode.id, nodeId));

  const response: CreateEditorNodeResponse = {
    canvasNode: toCanvasNodeResponse(newNode),
    canvasEdge: {
      id: edgeId,
      workspaceId,
      sourceNodeId: nodeId,
      targetNodeId: hostNode.id,
      createdAt: now.toISOString(),
    },
  };

  return c.json(response, 201);
});

// ─── Canvas Edges ───────────────────────────────────────────────────────────

// GET /edges - List all edges for the workspace
canvas.get("/edges", async (c) => {
  const workspaceId = c.get("workspaceId");
  const db = getDb();

  const rows = await db
    .select()
    .from(schema.canvasEdge)
    .where(eq(schema.canvasEdge.workspaceId, workspaceId));

  const response: ListCanvasEdgesResponse = {
    edges: rows.map((r): CanvasEdge => ({
      id: r.id,
      workspaceId: r.workspaceId,
      sourceNodeId: r.sourceNodeId,
      targetNodeId: r.targetNodeId,
      createdAt: r.createdAt.toISOString(),
    })),
  };

  return c.json(response);
});

// DELETE /edges/:id - Delete an edge
canvas.delete("/edges/:id", async (c) => {
  const workspaceId = c.get("workspaceId");
  const edgeId = c.req.param("id");
  const db = getDb();

  const [existing] = await db
    .select()
    .from(schema.canvasEdge)
    .where(
      and(
        eq(schema.canvasEdge.id, edgeId),
        eq(schema.canvasEdge.workspaceId, workspaceId),
      ),
    );

  if (!existing) {
    throw new HTTPException(404, { message: "Edge not found" });
  }

  await db
    .delete(schema.canvasEdge)
    .where(eq(schema.canvasEdge.id, edgeId));

  return c.json({ success: true });
});

export { canvas };
