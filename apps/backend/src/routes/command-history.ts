import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { eq, and, desc, sql } from "drizzle-orm";
import { getDb, schema } from "../db/index.js";
import type { WorkspaceVariables } from "../middleware/workspace.js";
import { toCanvasNodeResponse, toCanvasEdgeResponse } from "../lib/mappers.js";
import type {
  SaveCommandRequest,
  CreateCommandHistoryNodeRequest,
  CreateCommandHistoryNodeResponse,
} from "@excaliterm/shared-types";

const commandHistory = new Hono<{ Variables: WorkspaceVariables }>();

function toCommandHistoryResponse(r: typeof schema.commandHistory.$inferSelect) {
  return {
    id: r.id,
    terminalSessionId: r.terminalSessionId,
    command: r.command,
    executedAt: r.executedAt.toISOString(),
  };
}

commandHistory.post("/", async (c) => {
  const workspaceId = c.get("workspaceId");
  const body = await c.req.json<SaveCommandRequest>();
  const db = getDb();

  const command = (body.command ?? "").trim();
  if (!command || command.length > 1000) {
    throw new HTTPException(400, { message: "Command must be 1-1000 characters" });
  }

  if (!body.terminalSessionId) {
    throw new HTTPException(400, { message: "terminalSessionId is required" });
  }

  const [terminal] = await db
    .select()
    .from(schema.terminalSession)
    .where(
      and(
        eq(schema.terminalSession.id, body.terminalSessionId),
        eq(schema.terminalSession.workspaceId, workspaceId),
      ),
    );

  if (!terminal) {
    throw new HTTPException(404, { message: "Terminal session not found" });
  }

  const id = crypto.randomUUID();
  const now = new Date();

  await db.insert(schema.commandHistory).values({
    id,
    workspaceId,
    terminalSessionId: body.terminalSessionId,
    command,
    executedAt: now,
    createdAt: now,
  });

  return c.json({
    command: {
      id,
      terminalSessionId: body.terminalSessionId,
      command,
      executedAt: now.toISOString(),
    },
  }, 201);
});

commandHistory.get("/:terminalSessionId", async (c) => {
  const workspaceId = c.get("workspaceId");
  const terminalSessionId = c.req.param("terminalSessionId");
  const limit = Math.min(Number(c.req.query("limit") ?? 100), 500);
  const db = getDb();

  const rows = await db
    .select()
    .from(schema.commandHistory)
    .where(
      and(
        eq(schema.commandHistory.workspaceId, workspaceId),
        eq(schema.commandHistory.terminalSessionId, terminalSessionId),
      ),
    )
    .orderBy(desc(schema.commandHistory.executedAt))
    .limit(limit);

  return c.json({ commands: rows.map(toCommandHistoryResponse) });
});

commandHistory.get("/:terminalSessionId/top", async (c) => {
  const workspaceId = c.get("workspaceId");
  const terminalSessionId = c.req.param("terminalSessionId");
  const db = getDb();

  const rows = await db
    .select({
      command: schema.commandHistory.command,
      count: sql<number>`count(*)`.as("count"),
      lastExecutedAt: sql<string>`strftime('%Y-%m-%dT%H:%M:%SZ', max(${schema.commandHistory.executedAt}), 'unixepoch')`.as("lastExecutedAt"),
    })
    .from(schema.commandHistory)
    .where(
      and(
        eq(schema.commandHistory.workspaceId, workspaceId),
        eq(schema.commandHistory.terminalSessionId, terminalSessionId),
      ),
    )
    .groupBy(schema.commandHistory.command)
    .orderBy(sql`count(*) DESC`)
    .limit(10);

  return c.json({
    commands: rows.map((r) => ({
      command: r.command,
      count: Number(r.count),
      lastExecutedAt: r.lastExecutedAt,
    })),
  });
});

commandHistory.post("/node", async (c) => {
  const workspaceId = c.get("workspaceId");
  const body = await c.req.json<CreateCommandHistoryNodeRequest>();
  const db = getDb();

  if (!body.terminalSessionId || !body.sourceTerminalNodeId) {
    throw new HTTPException(400, { message: "terminalSessionId and sourceTerminalNodeId are required" });
  }

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

  const x = body.x ?? sourceNode.x + sourceNode.width + 60;
  const y = body.y ?? sourceNode.y;

  const nodeId = crypto.randomUUID();
  const edgeId = crypto.randomUUID();
  const now = new Date();

  await db.insert(schema.canvasNode).values({
    id: nodeId,
    workspaceId,
    nodeType: "command-history",
    terminalSessionId: body.terminalSessionId,
    x,
    y,
    width: 380,
    height: 420,
    createdAt: now,
    updatedAt: now,
  });

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

  const [newEdge] = await db
    .select()
    .from(schema.canvasEdge)
    .where(eq(schema.canvasEdge.id, edgeId));

  const response: CreateCommandHistoryNodeResponse = {
    canvasNode: toCanvasNodeResponse(newNode),
    canvasEdge: toCanvasEdgeResponse(newEdge),
  };

  return c.json(response, 201);
});

export { commandHistory };
