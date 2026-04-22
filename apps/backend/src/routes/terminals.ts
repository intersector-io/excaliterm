import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { eq, and, desc, count } from "drizzle-orm";
import { getDb, schema } from "../db/index.js";
import { publish } from "../lib/redis.js";
import type {
  CreateTerminalRequest,
  CreateTerminalResponse,
  ListTerminalsResponse,
  UpdateTerminalRequest,
} from "@excaliterm/shared-types";
import type { WorkspaceVariables } from "../middleware/workspace.js";

const terminals = new Hono<{ Variables: WorkspaceVariables }>();

function parseTags(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw.split(",").map((t) => t.trim()).filter(Boolean);
}

function serializeTags(tags: string[]): string {
  return tags.map((t) => t.trim()).filter(Boolean).join(",");
}

async function publishTerminalDestroy(
  db: ReturnType<typeof getDb>,
  terminal: typeof schema.terminalSession.$inferSelect,
  workspaceId: string,
): Promise<void> {
  let targetServiceId: string | undefined;

  if (terminal.serviceInstanceId) {
    const [service] = await db
      .select({ serviceId: schema.serviceInstance.serviceId })
      .from(schema.serviceInstance)
      .where(eq(schema.serviceInstance.id, terminal.serviceInstanceId));
    targetServiceId = service?.serviceId;
  }

  await publish("terminal:commands", {
    command: "terminal:destroy",
    terminalId: terminal.id,
    serviceInstanceId: targetServiceId,
    workspaceId,
  }).catch(
    (err) => console.error("[redis] Failed to publish terminal:destroy:", err.message),
  );
}

// POST / - Create a terminal session
terminals.post("/", async (c) => {
  const workspaceId = c.get("workspaceId");
  const body = (await c.req.json<CreateTerminalRequest>().catch(() => ({}))) as Partial<CreateTerminalRequest>;

  const cols = body.cols ?? 96;
  const rows = body.rows ?? 28;

  const db = getDb();

  // Count existing canvas nodes to cascade new terminal positions
  const [{ value: existingCount }] = await db
    .select({ value: count() })
    .from(schema.canvasNode)
    .where(eq(schema.canvasNode.workspaceId, workspaceId));

  const COLS = 3;
  const NODE_W = 760;
  const NODE_H = 480;
  const GAP_X = 40;
  const GAP_Y = 40;
  const ORIGIN_X = 72;
  const ORIGIN_Y = 76;

  const col = existingCount % COLS;
  const row = Math.floor(existingCount / COLS);
  const x = body.x ?? ORIGIN_X + col * (NODE_W + GAP_X);
  const y = body.y ?? ORIGIN_Y + row * (NODE_H + GAP_Y);

  // Resolve target service — use explicit pick or fall back to most-recent online
  let targetService;
  if (body.serviceInstanceId) {
    const [picked] = await db
      .select()
      .from(schema.serviceInstance)
      .where(
        and(
          eq(schema.serviceInstance.id, body.serviceInstanceId),
          eq(schema.serviceInstance.workspaceId, workspaceId),
          eq(schema.serviceInstance.status, "online"),
        ),
      );
    if (!picked) {
      throw new HTTPException(400, {
        message: "Selected service is not online",
      });
    }
    targetService = picked;
  } else {
    const [autoService] = await db
      .select()
      .from(schema.serviceInstance)
      .where(
        and(
          eq(schema.serviceInstance.workspaceId, workspaceId),
          eq(schema.serviceInstance.status, "online"),
        ),
      )
      .orderBy(
        desc(schema.serviceInstance.lastSeen),
        desc(schema.serviceInstance.updatedAt),
      );
    if (!autoService) {
      throw new HTTPException(503, {
        message: "No online service available for this workspace",
      });
    }
    targetService = autoService;
  }

  const terminalId = crypto.randomUUID();
  const nodeId = crypto.randomUUID();
  const now = new Date();

  await db.insert(schema.terminalSession).values({
    id: terminalId,
    workspaceId,
    serviceInstanceId: targetService.id,
    tags: serializeTags(body.tags ?? []),
    status: "active",
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(schema.canvasNode).values({
    id: nodeId,
    workspaceId,
    terminalSessionId: terminalId,
    nodeType: "terminal",
    x,
    y,
    width: 760,
    height: 480,
    zIndex: 0,
    createdAt: now,
    updatedAt: now,
  });

  // Create edge from terminal node to host node (if host node exists)
  const [hostNode] = await db
    .select()
    .from(schema.canvasNode)
    .where(
      and(
        eq(schema.canvasNode.workspaceId, workspaceId),
        eq(schema.canvasNode.nodeType, "host"),
        eq(schema.canvasNode.serviceInstanceId, targetService.id),
      ),
    );

  if (hostNode) {
    await db.insert(schema.canvasEdge).values({
      id: crypto.randomUUID(),
      workspaceId,
      sourceNodeId: nodeId,
      targetNodeId: hostNode.id,
    });
  }

  await publish("terminal:commands", {
    command: "terminal:create",
    terminalId,
    serviceInstanceId: targetService.serviceId,
    workspaceId,
    cols,
    rows,
  }).catch(
    (err) => console.error("[redis] Failed to publish terminal:create:", err.message),
  );

  const [terminal] = await db
    .select()
    .from(schema.terminalSession)
    .where(eq(schema.terminalSession.id, terminalId));

  const [canvasNode] = await db
    .select()
    .from(schema.canvasNode)
    .where(eq(schema.canvasNode.id, nodeId));

  const response: CreateTerminalResponse = {
    terminal: {
      id: terminal.id,
      serviceInstanceId: terminal.serviceInstanceId,
      serviceId: targetService.serviceId,
      tags: parseTags(terminal.tags),
      status: terminal.status,
      exitCode: terminal.exitCode,
      createdAt: terminal.createdAt.toISOString(),
      updatedAt: terminal.updatedAt.toISOString(),
    },
    canvasNode: {
      id: canvasNode.id,
      terminalSessionId: canvasNode.terminalSessionId,
      nodeType: canvasNode.nodeType,
      noteId: canvasNode.noteId,
      screenshotId: canvasNode.screenshotId,
      x: canvasNode.x,
      y: canvasNode.y,
      width: canvasNode.width,
      height: canvasNode.height,
      zIndex: canvasNode.zIndex,
      createdAt: canvasNode.createdAt.toISOString(),
      updatedAt: canvasNode.updatedAt.toISOString(),
    },
  };

  return c.json(response, 201);
});

// GET / - List workspace's terminal sessions
terminals.get("/", async (c) => {
  const workspaceId = c.get("workspaceId");
  const db = getDb();

  const rows = await db
    .select({
      terminal: schema.terminalSession,
      serviceId: schema.serviceInstance.serviceId,
    })
    .from(schema.terminalSession)
    .leftJoin(
      schema.serviceInstance,
      eq(schema.terminalSession.serviceInstanceId, schema.serviceInstance.id),
    )
    .where(eq(schema.terminalSession.workspaceId, workspaceId));

  const response: ListTerminalsResponse = {
    terminals: rows.map((r) => ({
      id: r.terminal.id,
      serviceInstanceId: r.terminal.serviceInstanceId,
      serviceId: r.serviceId ?? null,
      tags: parseTags(r.terminal.tags),
      status: r.terminal.status,
      exitCode: r.terminal.exitCode,
      createdAt: r.terminal.createdAt.toISOString(),
      updatedAt: r.terminal.updatedAt.toISOString(),
    })),
  };

  return c.json(response);
});

// PATCH /:id - Update terminal (tags)
terminals.patch("/:id", async (c) => {
  const workspaceId = c.get("workspaceId");
  const terminalId = c.req.param("id");
  const body = (await c.req.json<UpdateTerminalRequest>().catch(() => ({}))) as Partial<UpdateTerminalRequest>;
  const db = getDb();

  const [terminal] = await db
    .select()
    .from(schema.terminalSession)
    .where(
      and(
        eq(schema.terminalSession.id, terminalId),
        eq(schema.terminalSession.workspaceId, workspaceId),
      ),
    );

  if (!terminal) {
    throw new HTTPException(404, { message: "Terminal session not found" });
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (body.tags !== undefined) {
    updates.tags = serializeTags(body.tags);
  }

  await db
    .update(schema.terminalSession)
    .set(updates)
    .where(eq(schema.terminalSession.id, terminalId));

  const [updated] = await db
    .select()
    .from(schema.terminalSession)
    .where(eq(schema.terminalSession.id, terminalId));

  return c.json({
    terminal: {
      id: updated.id,
      tags: parseTags(updated.tags),
      status: updated.status,
      exitCode: updated.exitCode,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    },
  });
});

// DELETE /:id - Destroy a terminal
terminals.delete("/:id", async (c) => {
  const workspaceId = c.get("workspaceId");
  const terminalId = c.req.param("id");
  const db = getDb();

  const [terminal] = await db
    .select()
    .from(schema.terminalSession)
    .where(
      and(
        eq(schema.terminalSession.id, terminalId),
        eq(schema.terminalSession.workspaceId, workspaceId),
      ),
    );

  if (!terminal) {
    throw new HTTPException(404, { message: "Terminal session not found" });
  }

  if (terminal.status === "active") {
    await publishTerminalDestroy(db, terminal, workspaceId);
  }

  await db
    .update(schema.terminalSession)
    .set({ status: "exited", updatedAt: new Date() })
    .where(eq(schema.terminalSession.id, terminalId));

  return c.json({ success: true });
});

// DELETE / - Close all terminals in workspace
terminals.delete("/", async (c) => {
  const workspaceId = c.get("workspaceId");
  const db = getDb();

  const activeTerminals = await db
    .select()
    .from(schema.terminalSession)
    .where(
      and(
        eq(schema.terminalSession.workspaceId, workspaceId),
        eq(schema.terminalSession.status, "active"),
      ),
    );

  for (const terminal of activeTerminals) {
    await publishTerminalDestroy(db, terminal, workspaceId);
  }

  // Mark all active terminals as exited
  await db
    .update(schema.terminalSession)
    .set({ status: "exited", updatedAt: new Date() })
    .where(
      and(
        eq(schema.terminalSession.workspaceId, workspaceId),
        eq(schema.terminalSession.status, "active"),
      ),
    );

  // Remove all canvas nodes for this workspace
  await db
    .delete(schema.canvasNode)
    .where(eq(schema.canvasNode.workspaceId, workspaceId));

  return c.json({ success: true, closed: activeTerminals.length });
});

export { terminals };
