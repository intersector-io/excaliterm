import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Hono } from "hono";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { eq } from "drizzle-orm";
import * as schema from "../../src/db/schema.js";

// ─── Mocks ────────────────────────────────────────────────────────────────

const mockGetDb = vi.fn();
vi.mock("../../src/db/index.js", () => ({
  getDb: () => mockGetDb(),
  schema,
}));

import { canvas } from "../../src/routes/canvas.js";

// ─── Helpers ──────────────────────────────────────────────────────────────

function createTestDb() {
  const sqlite = new Database(":memory:");
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.exec(`
    CREATE TABLE "user" (
      "id" text PRIMARY KEY NOT NULL,
      "name" text NOT NULL,
      "email" text NOT NULL UNIQUE,
      "emailVerified" integer NOT NULL DEFAULT 0,
      "image" text,
      "createdAt" integer NOT NULL,
      "updatedAt" integer NOT NULL
    );
    CREATE TABLE "terminal_session" (
      "id" text PRIMARY KEY NOT NULL,
      "userId" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
      "status" text NOT NULL DEFAULT 'active',
      "exitCode" integer,
      "createdAt" integer NOT NULL DEFAULT (unixepoch()),
      "updatedAt" integer NOT NULL DEFAULT (unixepoch())
    );
    CREATE TABLE "canvas_node" (
      "id" text PRIMARY KEY NOT NULL,
      "terminalSessionId" text REFERENCES "terminal_session"("id") ON DELETE SET NULL,
      "userId" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
      "x" real NOT NULL DEFAULT 100,
      "y" real NOT NULL DEFAULT 100,
      "width" real NOT NULL DEFAULT 600,
      "height" real NOT NULL DEFAULT 400,
      "zIndex" integer NOT NULL DEFAULT 0,
      "createdAt" integer NOT NULL DEFAULT (unixepoch()),
      "updatedAt" integer NOT NULL DEFAULT (unixepoch())
    );
  `);
  return drizzle(sqlite, { schema });
}

function createApp(userId: string) {
  const app = new Hono();
  app.use("*", async (c, next) => {
    c.set("userId", userId);
    await next();
  });
  app.route("/api/canvas", canvas);
  return app;
}

function seedUser(db: ReturnType<typeof createTestDb>, userId: string) {
  const now = new Date();
  db.insert(schema.user).values({
    id: userId,
    name: "Test User",
    email: `${userId}@test.com`,
    emailVerified: false,
    createdAt: now,
    updatedAt: now,
  }).run();
}

function seedCanvasNode(
  db: ReturnType<typeof createTestDb>,
  nodeId: string,
  userId: string,
  overrides: Partial<typeof schema.canvasNode.$inferInsert> = {},
) {
  const now = new Date();
  db.insert(schema.canvasNode).values({
    id: nodeId,
    userId,
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

// ─── Tests ────────────────────────────────────────────────────────────────

describe("Canvas Nodes", () => {
  let db: ReturnType<typeof createTestDb>;

  beforeEach(() => {
    db = createTestDb();
    mockGetDb.mockReturnValue(db);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("GET /api/canvas/nodes - List canvas nodes", () => {
    it("should return only the current user's canvas nodes", async () => {
      const userId1 = "user-1";
      const userId2 = "user-2";
      seedUser(db, userId1);
      seedUser(db, userId2);

      seedCanvasNode(db, "node-1", userId1);
      seedCanvasNode(db, "node-2", userId1, { x: 200, y: 200 });
      seedCanvasNode(db, "node-3", userId2);

      const app = createApp(userId1);
      const res = await app.request("/api/canvas/nodes", { method: "GET" });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.nodes).toHaveLength(2);
      expect(body.nodes.every((n: { userId: string }) => n.userId === userId1)).toBe(true);
    });

    it("should return an empty list when user has no nodes", async () => {
      const userId = "user-1";
      seedUser(db, userId);
      const app = createApp(userId);

      const res = await app.request("/api/canvas/nodes", { method: "GET" });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.nodes).toHaveLength(0);
    });

    it("should return nodes with correct shape including ISO date strings", async () => {
      const userId = "user-1";
      seedUser(db, userId);
      seedCanvasNode(db, "node-1", userId, { x: 150, y: 250, width: 700, height: 500, zIndex: 3 });

      const app = createApp(userId);
      const res = await app.request("/api/canvas/nodes", { method: "GET" });

      const body = await res.json();
      const node = body.nodes[0];
      expect(node.id).toBe("node-1");
      expect(node.userId).toBe(userId);
      expect(node.x).toBe(150);
      expect(node.y).toBe(250);
      expect(node.width).toBe(700);
      expect(node.height).toBe(500);
      expect(node.zIndex).toBe(3);
      expect(typeof node.createdAt).toBe("string");
      expect(typeof node.updatedAt).toBe("string");
    });
  });

  describe("PATCH /api/canvas/nodes/:id - Update node position/size", () => {
    it("should update node position", async () => {
      const userId = "user-1";
      seedUser(db, userId);
      seedCanvasNode(db, "node-1", userId);

      const app = createApp(userId);
      const res = await app.request("/api/canvas/nodes/node-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ x: 500, y: 600 }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.node.x).toBe(500);
      expect(body.node.y).toBe(600);

      // Verify in DB
      const [dbNode] = await db
        .select()
        .from(schema.canvasNode)
        .where(eq(schema.canvasNode.id, "node-1"));
      expect(dbNode.x).toBe(500);
      expect(dbNode.y).toBe(600);
    });

    it("should update node dimensions", async () => {
      const userId = "user-1";
      seedUser(db, userId);
      seedCanvasNode(db, "node-1", userId);

      const app = createApp(userId);
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

    it("should update zIndex", async () => {
      const userId = "user-1";
      seedUser(db, userId);
      seedCanvasNode(db, "node-1", userId);

      const app = createApp(userId);
      const res = await app.request("/api/canvas/nodes/node-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ zIndex: 5 }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.node.zIndex).toBe(5);
    });

    it("should not modify fields that are not sent", async () => {
      const userId = "user-1";
      seedUser(db, userId);
      seedCanvasNode(db, "node-1", userId, { x: 100, y: 200, width: 600, height: 400 });

      const app = createApp(userId);
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

    it("should return 404 when node does not exist", async () => {
      const userId = "user-1";
      seedUser(db, userId);
      const app = createApp(userId);

      const res = await app.request("/api/canvas/nodes/nonexistent", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ x: 500 }),
      });

      expect(res.status).toBe(404);
    });

    it("should return 404 when trying to update another user's node", async () => {
      const userId1 = "user-1";
      const userId2 = "user-2";
      seedUser(db, userId1);
      seedUser(db, userId2);
      seedCanvasNode(db, "node-1", userId2);

      const app = createApp(userId1);
      const res = await app.request("/api/canvas/nodes/node-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ x: 500 }),
      });

      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /api/canvas/nodes/:id - Delete a node", () => {
    it("should delete the canvas node", async () => {
      const userId = "user-1";
      seedUser(db, userId);
      seedCanvasNode(db, "node-1", userId);

      const app = createApp(userId);
      const res = await app.request("/api/canvas/nodes/node-1", { method: "DELETE" });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);

      // Verify deleted from DB
      const rows = await db
        .select()
        .from(schema.canvasNode)
        .where(eq(schema.canvasNode.id, "node-1"));
      expect(rows).toHaveLength(0);
    });

    it("should return 404 when node does not exist", async () => {
      const userId = "user-1";
      seedUser(db, userId);
      const app = createApp(userId);

      const res = await app.request("/api/canvas/nodes/nonexistent", { method: "DELETE" });

      expect(res.status).toBe(404);
    });

    it("should return 404 when trying to delete another user's node", async () => {
      const userId1 = "user-1";
      const userId2 = "user-2";
      seedUser(db, userId1);
      seedUser(db, userId2);
      seedCanvasNode(db, "node-1", userId2);

      const app = createApp(userId1);
      const res = await app.request("/api/canvas/nodes/node-1", { method: "DELETE" });

      expect(res.status).toBe(404);

      // Verify node still exists
      const rows = await db
        .select()
        .from(schema.canvasNode)
        .where(eq(schema.canvasNode.id, "node-1"));
      expect(rows).toHaveLength(1);
    });
  });
});
