import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { v4 as uuidv4 } from "uuid";
import { eq, and } from "drizzle-orm";
import { getDb, schema } from "../db/index.js";
import type { WorkspaceVariables } from "../middleware/workspace.js";

const notes = new Hono<{ Variables: WorkspaceVariables }>();

// GET / - List workspace's notes
notes.get("/", async (c) => {
  const workspaceId = c.get("workspaceId");
  const db = getDb();

  const rows = await db
    .select()
    .from(schema.note)
    .where(eq(schema.note.workspaceId, workspaceId));

  return c.json({
    notes: rows.map((n) => ({
      id: n.id,
      content: n.content,
      createdAt: n.createdAt.toISOString(),
      updatedAt: n.updatedAt.toISOString(),
    })),
  });
});

// POST / - Create note (also creates canvas_node with nodeType='note')
notes.post("/", async (c) => {
  const workspaceId = c.get("workspaceId");
  const body = (await c.req.json<{ content?: string; x?: number; y?: number }>().catch(() => ({}))) as { content?: string; x?: number; y?: number };
  const db = getDb();

  const noteId = uuidv4();
  const nodeId = uuidv4();
  const now = new Date();

  await db.insert(schema.note).values({
    id: noteId,
    workspaceId,
    content: body.content ?? "",
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(schema.canvasNode).values({
    id: nodeId,
    workspaceId,
    nodeType: "note",
    noteId,
    x: body.x ?? 100,
    y: body.y ?? 100,
    width: 300,
    height: 300,
    zIndex: 0,
    createdAt: now,
    updatedAt: now,
  });

  const [created] = await db
    .select()
    .from(schema.note)
    .where(eq(schema.note.id, noteId));

  const [canvasNode] = await db
    .select()
    .from(schema.canvasNode)
    .where(eq(schema.canvasNode.id, nodeId));

  return c.json(
    {
      note: {
        id: created.id,
        content: created.content,
        createdAt: created.createdAt.toISOString(),
        updatedAt: created.updatedAt.toISOString(),
      },
      canvasNode: {
        id: canvasNode.id,
        terminalSessionId: canvasNode.terminalSessionId,
        nodeType: canvasNode.nodeType,
        noteId: canvasNode.noteId,
        x: canvasNode.x,
        y: canvasNode.y,
        width: canvasNode.width,
        height: canvasNode.height,
        zIndex: canvasNode.zIndex,
        createdAt: canvasNode.createdAt.toISOString(),
        updatedAt: canvasNode.updatedAt.toISOString(),
      },
    },
    201,
  );
});

// PATCH /:id - Update note content
notes.patch("/:id", async (c) => {
  const workspaceId = c.get("workspaceId");
  const noteId = c.req.param("id");
  const db = getDb();

  const [existing] = await db
    .select()
    .from(schema.note)
    .where(
      and(
        eq(schema.note.id, noteId),
        eq(schema.note.workspaceId, workspaceId),
      ),
    );

  if (!existing) {
    throw new HTTPException(404, { message: "Note not found" });
  }

  const body = await c.req.json<{ content?: string }>();
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (body.content !== undefined) updates.content = body.content;

  await db
    .update(schema.note)
    .set(updates)
    .where(eq(schema.note.id, noteId));

  const [updated] = await db
    .select()
    .from(schema.note)
    .where(eq(schema.note.id, noteId));

  return c.json({
    note: {
      id: updated.id,
      content: updated.content,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    },
  });
});

// DELETE /:id - Delete note + its canvas_node
notes.delete("/:id", async (c) => {
  const workspaceId = c.get("workspaceId");
  const noteId = c.req.param("id");
  const db = getDb();

  const [existing] = await db
    .select()
    .from(schema.note)
    .where(
      and(
        eq(schema.note.id, noteId),
        eq(schema.note.workspaceId, workspaceId),
      ),
    );

  if (!existing) {
    throw new HTTPException(404, { message: "Note not found" });
  }

  await db
    .delete(schema.canvasNode)
    .where(eq(schema.canvasNode.noteId, noteId));

  await db
    .delete(schema.note)
    .where(eq(schema.note.id, noteId));

  return c.json({ success: true });
});

export { notes };
