import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Hono } from "hono";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { eq } from "drizzle-orm";
import * as schema from "../../src/db/schema.js";

const mockGetDb = vi.fn();
vi.mock("../../src/db/index.js", () => ({
  getDb: () => mockGetDb(),
  schema,
}));

import { canvas } from "../../src/routes/canvas.js";

function createTestDb() {
  const sqlite = new Database(":memory:");
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.exec(`
    CREATE TABLE "workspace" (
      "id" text PRIMARY KEY NOT NULL,
      "name" text NOT NULL DEFAULT 'Untitled workspace',
      "apiKey" text NOT NULL DEFAULT '',
      "createdAt" integer NOT NULL,
      "lastAccessedAt" integer NOT NULL
    );
    CREATE TABLE "note" (
      "id" text PRIMARY KEY NOT NULL,
      "workspaceId" text NOT NULL REFERENCES "workspace"("id") ON DELETE CASCADE,
      "content" text DEFAULT '',
      "createdAt" integer NOT NULL,
      "updatedAt" integer NOT NULL
    );
    CREATE TABLE "service_instance" (
      "id" text PRIMARY KEY NOT NULL,
      "workspaceId" text NOT NULL REFERENCES "workspace"("id") ON DELETE CASCADE,
      "serviceId" text NOT NULL,
      "name" text NOT NULL,
      "apiKey" text NOT NULL,
      "whitelistedPaths" text,
      "lastSeen" integer,
      "status" text DEFAULT 'offline',
      "createdAt" integer NOT NULL,
      "updatedAt" integer NOT NULL
    );
    CREATE UNIQUE INDEX "service_instance_workspace_service_unique"
      ON "service_instance"("workspaceId", "serviceId");
    CREATE TABLE "terminal_session" (
      "id" text PRIMARY KEY NOT NULL,
      "workspaceId" text NOT NULL REFERENCES "workspace"("id") ON DELETE CASCADE,
      "serviceInstanceId" text,
      "tags" text DEFAULT '',
      "status" text NOT NULL DEFAULT 'active',
      "exitCode" integer,
      "createdAt" integer NOT NULL,
      "updatedAt" integer NOT NULL
    );
    CREATE TABLE "canvas_node" (
      "id" text PRIMARY KEY NOT NULL,
      "workspaceId" text NOT NULL REFERENCES "workspace"("id") ON DELETE CASCADE,
      "terminalSessionId" text REFERENCES "terminal_session"("id") ON DELETE SET NULL,
      "nodeType" text NOT NULL DEFAULT 'terminal',
      "noteId" text REFERENCES "note"("id") ON DELETE SET NULL,
      "screenshotId" text,
      "serviceInstanceId" text REFERENCES "service_instance"("id") ON DELETE SET NULL,
      "x" real NOT NULL DEFAULT 100,
      "y" real NOT NULL DEFAULT 100,
      "width" real NOT NULL DEFAULT 600,
      "height" real NOT NULL DEFAULT 400,
      "zIndex" integer NOT NULL DEFAULT 0,
      "createdAt" integer NOT NULL,
      "updatedAt" integer NOT NULL
    );
  `);
  return drizzle(sqlite, { schema });
}

function createApp(workspaceId = "ws-1") {
  const app = new Hono();
  app.use("*", async (c, next) => {
    c.set("workspaceId", workspaceId);
    await next();
  });
  app.route("/api/canvas", canvas);
  return app;
}

function seedWorkspace(
  db: ReturnType<typeof createTestDb>,
  workspaceId = "ws-1",
) {
  const now = new Date();
  db.insert(schema.workspace).values({
    id: workspaceId,
    name: `Workspace ${workspaceId}`,
    createdAt: now,
    lastAccessedAt: now,
  }).run();
}

function seedCanvasNode(
  db: ReturnType<typeof createTestDb>,
  nodeId: string,
  workspaceId: string,
  overrides: Partial<typeof schema.canvasNode.$inferInsert> = {},
) {
  const now = new Date();
  db.insert(schema.canvasNode).values({
    id: nodeId,
    workspaceId,
    nodeType: "terminal",
    x: 100,
    y: 100,
    width: 600,
    height: 400,
    zIndex: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }).run();
}

function seedNote(
  db: ReturnType<typeof createTestDb>,
  noteId: string,
  workspaceId: string,
) {
  const now = new Date();
  db.insert(schema.note).values({
    id: noteId,
    workspaceId,
    content: "Test note",
    createdAt: now,
    updatedAt: now,
  }).run();
}

describe("Canvas Nodes", () => {
  let db: ReturnType<typeof createTestDb>;

  beforeEach(() => {
    db = createTestDb();
    mockGetDb.mockReturnValue(db);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("GET /api/canvas/nodes", () => {
    it("returns only the current workspace canvas nodes", async () => {
      seedWorkspace(db, "ws-1");
      seedWorkspace(db, "ws-2");

      seedCanvasNode(db, "node-1", "ws-1");
      seedCanvasNode(db, "node-2", "ws-1", { x: 200, y: 200 });
      seedCanvasNode(db, "node-3", "ws-2");

      const app = createApp("ws-1");
      const res = await app.request("/api/canvas/nodes", { method: "GET" });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.nodes).toHaveLength(2);
      expect(body.nodes.map((n: { id: string }) => n.id)).toEqual(
        expect.arrayContaining(["node-1", "node-2"]),
      );
    });

    it("returns an empty list when the workspace has no nodes", async () => {
      seedWorkspace(db, "ws-1");
      const app = createApp("ws-1");

      const res = await app.request("/api/canvas/nodes", { method: "GET" });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.nodes).toHaveLength(0);
    });

    it("returns nodes with the expected response shape", async () => {
      seedWorkspace(db, "ws-1");
      seedNote(db, "note-1", "ws-1");
      seedCanvasNode(db, "node-1", "ws-1", {
        nodeType: "note",
        noteId: "note-1",
        x: 150,
        y: 250,
        width: 700,
        height: 500,
        zIndex: 3,
      });

      const app = createApp("ws-1");
      const res = await app.request("/api/canvas/nodes", { method: "GET" });

      const body = await res.json();
      const node = body.nodes[0];
      expect(node.id).toBe("node-1");
      expect(node.nodeType).toBe("note");
      expect(node.noteId).toBe("note-1");
      expect(node.x).toBe(150);
      expect(node.y).toBe(250);
      expect(node.width).toBe(700);
      expect(node.height).toBe(500);
      expect(node.zIndex).toBe(3);
      expect(typeof node.createdAt).toBe("string");
      expect(typeof node.updatedAt).toBe("string");
    });
  });

  describe("PATCH /api/canvas/nodes/:id", () => {
    it("updates node position", async () => {
      seedWorkspace(db, "ws-1");
      seedCanvasNode(db, "node-1", "ws-1");

      const app = createApp("ws-1");
      const res = await app.request("/api/canvas/nodes/node-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ x: 500, y: 600 }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.node.x).toBe(500);
      expect(body.node.y).toBe(600);

      const [dbNode] = await db
        .select()
        .from(schema.canvasNode)
        .where(eq(schema.canvasNode.id, "node-1"));
      expect(dbNode.x).toBe(500);
      expect(dbNode.y).toBe(600);
    });

    it("updates node dimensions", async () => {
      seedWorkspace(db, "ws-1");
      seedCanvasNode(db, "node-1", "ws-1");

      const app = createApp("ws-1");
      const res = await app.request("/api/canvas/nodes/node-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ width: 800, height: 600 }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.node.width).toBe(800);
      expect(body.node.height).toBe(600);
    });

    it("updates zIndex", async () => {
      seedWorkspace(db, "ws-1");
      seedCanvasNode(db, "node-1", "ws-1");

      const app = createApp("ws-1");
      const res = await app.request("/api/canvas/nodes/node-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ zIndex: 5 }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.node.zIndex).toBe(5);
    });

    it("does not modify fields that are not sent", async () => {
      seedWorkspace(db, "ws-1");
      seedCanvasNode(db, "node-1", "ws-1", {
        x: 100,
        y: 200,
        width: 600,
        height: 400,
      });

      const app = createApp("ws-1");
      const res = await app.request("/api/canvas/nodes/node-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ x: 999 }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.node.x).toBe(999);
      expect(body.node.y).toBe(200);
      expect(body.node.width).toBe(600);
      expect(body.node.height).toBe(400);
    });

    it("returns 404 when node does not exist", async () => {
      seedWorkspace(db, "ws-1");
      const app = createApp("ws-1");

      const res = await app.request("/api/canvas/nodes/nonexistent", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ x: 500 }),
      });

      expect(res.status).toBe(404);
    });

    it("returns 404 when trying to update another workspace's node", async () => {
      seedWorkspace(db, "ws-1");
      seedWorkspace(db, "ws-2");
      seedCanvasNode(db, "node-1", "ws-2");

      const app = createApp("ws-1");
      const res = await app.request("/api/canvas/nodes/node-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ x: 500 }),
      });

      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /api/canvas/nodes/:id", () => {
    it("deletes the canvas node", async () => {
      seedWorkspace(db, "ws-1");
      seedCanvasNode(db, "node-1", "ws-1");

      const app = createApp("ws-1");
      const res = await app.request("/api/canvas/nodes/node-1", {
        method: "DELETE",
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);

      const rows = await db
        .select()
        .from(schema.canvasNode)
        .where(eq(schema.canvasNode.id, "node-1"));
      expect(rows).toHaveLength(0);
    });

    it("returns 404 when node does not exist", async () => {
      seedWorkspace(db, "ws-1");
      const app = createApp("ws-1");

      const res = await app.request("/api/canvas/nodes/nonexistent", {
        method: "DELETE",
      });

      expect(res.status).toBe(404);
    });

    it("returns 404 when trying to delete another workspace's node", async () => {
      seedWorkspace(db, "ws-1");
      seedWorkspace(db, "ws-2");
      seedCanvasNode(db, "node-1", "ws-2");

      const app = createApp("ws-1");
      const res = await app.request("/api/canvas/nodes/node-1", {
        method: "DELETE",
      });

      expect(res.status).toBe(404);

      const rows = await db
        .select()
        .from(schema.canvasNode)
        .where(eq(schema.canvasNode.id, "node-1"));
      expect(rows).toHaveLength(1);
    });
  });
});
