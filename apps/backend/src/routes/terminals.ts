import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { v4 as uuidv4 } from "uuid";
import { eq, and, desc } from "drizzle-orm";
import { getDb, schema } from "../db/index.js";
import { publish } from "../lib/redis.js";
import type {
  CreateTerminalRequest,
  CreateTerminalResponse,
  ListTerminalsResponse,
} from "@terminal-proxy/shared-types";
import type { WorkspaceVariables } from "../middleware/workspace.js";

const terminals = new Hono<{ Variables: WorkspaceVariables }>();

// POST / - Create a terminal session
terminals.post("/", async (c) => {
  const workspaceId = c.get("workspaceId");
  const body = (await c.req.json<CreateTerminalRequest>().catch(() => ({}))) as Partial<CreateTerminalRequest>;

  const cols = body.cols ?? 96;
  const rows = body.rows ?? 28;
  const x = body.x ?? 72;
  const y = body.y ?? 76;

  const db = getDb();

  // Check if any service is online for this workspace
  const [targetService] = await db
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

  if (!targetService) {
    throw new HTTPException(503, {
      message: "No online service available for this workspace",
    });
  }

  const terminalId = uuidv4();
  const nodeId = uuidv4();
  const now = new Date();

  await db.insert(schema.terminalSession).values({
    id: terminalId,
    workspaceId,
    serviceInstanceId: targetService.id,
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

  await publish("terminal:commands", {
    command: "terminal:create",
    terminalId,
    serviceInstanceId: targetService.serviceId,
    workspaceId,
    tenantId: workspaceId,
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
    .select()
    .from(schema.terminalSession)
    .where(eq(schema.terminalSession.workspaceId, workspaceId));

  const response: ListTerminalsResponse = {
    terminals: rows.map((t) => ({
      id: t.id,
      status: t.status,
      exitCode: t.exitCode,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    })),
  };

  return c.json(response);
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
      terminalId,
      serviceInstanceId: targetServiceId,
      workspaceId,
      tenantId: workspaceId,
    }).catch(
      (err) => console.error("[redis] Failed to publish terminal:destroy:", err.message),
    );
  }

  await db
    .update(schema.terminalSession)
    .set({ status: "exited", updatedAt: new Date() })
    .where(eq(schema.terminalSession.id, terminalId));

  return c.json({ success: true });
});

export { terminals };
