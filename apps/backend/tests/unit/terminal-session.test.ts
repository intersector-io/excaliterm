import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { eq } from "drizzle-orm";
import * as schema from "../../src/db/schema.js";

let uuidCounter = 0;
vi.mock("uuid", () => ({
  v4: () => `test-uuid-${++uuidCounter}`,
}));

const mockPublish = vi.fn().mockResolvedValue(undefined);
vi.mock("../../src/lib/redis.js", () => ({
  publish: (...args: unknown[]) => mockPublish(...args),
}));

const mockGetDb = vi.fn();
vi.mock("../../src/db/index.js", () => ({
  getDb: () => mockGetDb(),
  schema,
}));

import { terminals } from "../../src/routes/terminals.js";

function createTestDb() {
  const sqlite = new Database(":memory:");
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.exec(`
    CREATE TABLE "workspace" (
      "id" text PRIMARY KEY NOT NULL,
      "name" text NOT NULL DEFAULT 'Untitled workspace',
      "createdAt" integer NOT NULL,
      "lastAccessedAt" integer NOT NULL
    );
    CREATE TABLE "service_instance" (
      "id" text PRIMARY KEY NOT NULL,
      "workspaceId" text NOT NULL REFERENCES "workspace"("id") ON DELETE CASCADE,
      "serviceId" text NOT NULL UNIQUE,
      "name" text NOT NULL,
      "apiKey" text NOT NULL,
      "whitelistedPaths" text,
      "lastSeen" integer,
      "status" text DEFAULT 'offline',
      "createdAt" integer NOT NULL,
      "updatedAt" integer NOT NULL
    );
    CREATE TABLE "note" (
      "id" text PRIMARY KEY NOT NULL,
      "workspaceId" text NOT NULL REFERENCES "workspace"("id") ON DELETE CASCADE,
      "content" text DEFAULT '',
      "createdAt" integer NOT NULL,
      "updatedAt" integer NOT NULL
    );
    CREATE TABLE "terminal_session" (
      "id" text PRIMARY KEY NOT NULL,
      "workspaceId" text NOT NULL REFERENCES "workspace"("id") ON DELETE CASCADE,
      "serviceInstanceId" text REFERENCES "service_instance"("id") ON DELETE SET NULL,
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
  app.route("/api/terminals", terminals);
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

function seedOnlineService(
  db: ReturnType<typeof createTestDb>,
  workspaceId = "ws-1",
  serviceRowId = "svc-row-1",
  serviceId = "svc-public-1",
) {
  const now = new Date();
  db.insert(schema.serviceInstance).values({
    id: serviceRowId,
    workspaceId,
    serviceId,
    name: `Service ${serviceId}`,
    apiKey: "test-key",
    status: "online",
    lastSeen: now,
    createdAt: now,
    updatedAt: now,
  }).run();
}

describe("Terminal Sessions", () => {
  let db: ReturnType<typeof createTestDb>;

  beforeEach(() => {
    uuidCounter = 0;
    db = createTestDb();
    mockGetDb.mockReset();
    mockGetDb.mockReturnValue(db);
    mockPublish.mockReset();
    mockPublish.mockResolvedValue(undefined);
  });

  describe("POST /api/terminals", () => {
    it("creates a terminal session and canvas node in the DB", async () => {
      seedWorkspace(db);
      seedOnlineService(db, "ws-1", "svc-row-1", "svc-public-1");
      const app = createApp();

      const res = await app.request("/api/terminals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cols: 120, rows: 40, x: 200, y: 300 }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();

      expect(body.terminal).toBeDefined();
      expect(body.terminal.id).toBe("test-uuid-1");
      expect(body.terminal.status).toBe("active");

      expect(body.canvasNode).toBeDefined();
      expect(body.canvasNode.id).toBe("test-uuid-2");
      expect(body.canvasNode.terminalSessionId).toBe("test-uuid-1");
      expect(body.canvasNode.x).toBe(200);
      expect(body.canvasNode.y).toBe(300);
      expect(body.canvasNode.width).toBe(760);
      expect(body.canvasNode.height).toBe(480);

      const [dbTerminal] = await db
        .select()
        .from(schema.terminalSession)
        .where(eq(schema.terminalSession.id, "test-uuid-1"));
      expect(dbTerminal).toBeDefined();
      expect(dbTerminal.workspaceId).toBe("ws-1");
      expect(dbTerminal.serviceInstanceId).toBe("svc-row-1");

      const [dbNode] = await db
        .select()
        .from(schema.canvasNode)
        .where(eq(schema.canvasNode.id, "test-uuid-2"));
      expect(dbNode).toBeDefined();
      expect(dbNode.workspaceId).toBe("ws-1");
      expect(dbNode.terminalSessionId).toBe("test-uuid-1");
    });

    it("publishes a create command via Redis", async () => {
      seedWorkspace(db);
      seedOnlineService(db, "ws-1", "svc-row-1", "svc-public-1");
      const app = createApp();

      await app.request("/api/terminals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cols: 80, rows: 24 }),
      });

      expect(mockPublish).toHaveBeenCalledWith(
        "terminal:commands",
        expect.objectContaining({
          command: "terminal:create",
          terminalId: "test-uuid-1",
          serviceInstanceId: "svc-public-1",
          workspaceId: "ws-1",
          tenantId: "ws-1",
          cols: 80,
          rows: 24,
        }),
      );
    });

    it("uses the focused terminal defaults when not provided", async () => {
      seedWorkspace(db);
      seedOnlineService(db);
      const app = createApp();

      const res = await app.request("/api/terminals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.canvasNode.x).toBe(72);
      expect(body.canvasNode.y).toBe(76);

      expect(mockPublish).toHaveBeenCalledWith(
        "terminal:commands",
        expect.objectContaining({ cols: 96, rows: 28 }),
      );
    });

    it("returns 503 when no online service is available", async () => {
      seedWorkspace(db);
      const app = createApp();

      const res = await app.request("/api/terminals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(503);
    });
  });

  describe("GET /api/terminals", () => {
    it("returns only the current workspace terminals", async () => {
      seedWorkspace(db, "ws-1");
      seedWorkspace(db, "ws-2");

      const now = new Date();
      await db.insert(schema.terminalSession).values([
        {
          id: "t1",
          workspaceId: "ws-1",
          status: "active",
          createdAt: now,
          updatedAt: now,
        },
        {
          id: "t2",
          workspaceId: "ws-1",
          status: "exited",
          createdAt: now,
          updatedAt: now,
        },
        {
          id: "t3",
          workspaceId: "ws-2",
          status: "active",
          createdAt: now,
          updatedAt: now,
        },
      ]);

      const app = createApp("ws-1");
      const res = await app.request("/api/terminals", { method: "GET" });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.terminals).toHaveLength(2);
      expect(body.terminals.map((t: { id: string }) => t.id)).toEqual(
        expect.arrayContaining(["t1", "t2"]),
      );
    });

    it("returns an empty list when the workspace has no terminals", async () => {
      seedWorkspace(db);
      const app = createApp();

      const res = await app.request("/api/terminals", { method: "GET" });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.terminals).toHaveLength(0);
    });
  });

  describe("DELETE /api/terminals/:id", () => {
    it("marks the terminal as exited and publishes destroy via Redis", async () => {
      seedWorkspace(db);
      seedOnlineService(db, "ws-1", "svc-row-1", "svc-public-1");
      const now = new Date();

      await db.insert(schema.terminalSession).values({
        id: "t1",
        workspaceId: "ws-1",
        serviceInstanceId: "svc-row-1",
        status: "active",
        createdAt: now,
        updatedAt: now,
      });

      const app = createApp();
      const res = await app.request("/api/terminals/t1", { method: "DELETE" });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);

      const [updated] = await db
        .select()
        .from(schema.terminalSession)
        .where(eq(schema.terminalSession.id, "t1"));
      expect(updated.status).toBe("exited");

      expect(mockPublish).toHaveBeenCalledWith(
        "terminal:commands",
        expect.objectContaining({
          command: "terminal:destroy",
          terminalId: "t1",
          serviceInstanceId: "svc-public-1",
          workspaceId: "ws-1",
          tenantId: "ws-1",
        }),
      );
    });

    it("returns 404 when terminal does not exist", async () => {
      seedWorkspace(db);
      const app = createApp();

      const res = await app.request("/api/terminals/nonexistent", {
        method: "DELETE",
      });

      expect(res.status).toBe(404);
    });

    it("returns 404 when deleting another workspace's terminal", async () => {
      seedWorkspace(db, "ws-1");
      seedWorkspace(db, "ws-2");
      const now = new Date();

      await db.insert(schema.terminalSession).values({
        id: "t1",
        workspaceId: "ws-2",
        status: "active",
        createdAt: now,
        updatedAt: now,
      });

      const app = createApp("ws-1");
      const res = await app.request("/api/terminals/t1", { method: "DELETE" });

      expect(res.status).toBe(404);
    });

    it("does not publish destroy if terminal is already exited", async () => {
      seedWorkspace(db);
      const now = new Date();

      await db.insert(schema.terminalSession).values({
        id: "t1",
        workspaceId: "ws-1",
        status: "exited",
        createdAt: now,
        updatedAt: now,
      });

      const app = createApp();
      await app.request("/api/terminals/t1", { method: "DELETE" });

      expect(mockPublish).not.toHaveBeenCalled();
    });
  });
});
