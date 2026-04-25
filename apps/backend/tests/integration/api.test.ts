import { describe, it, expect, vi, afterAll, beforeEach } from "vitest";
import { Hono } from "hono";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { HTTPException } from "hono/http-exception";
import * as schema from "../../src/db/schema.js";
import { workspaceMiddleware } from "../../src/middleware/workspace.js";

let uuidCounter = 0;
vi.mock("uuid", () => ({
  v4: () => `int-uuid-${++uuidCounter}`,
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

import { health } from "../../src/routes/health.js";
import { terminals } from "../../src/routes/terminals.js";
import { canvas } from "../../src/routes/canvas.js";

type TestDb = ReturnType<typeof drizzle<typeof schema>>;

const TEST_WORKSPACE_ID = "int-ws-1";

function createTestDb(): TestDb {
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
      "tags" text DEFAULT '',
      "status" text NOT NULL DEFAULT 'active',
      "exitCode" integer,
      "readToken" text NOT NULL DEFAULT '',
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
      "triggerId" text,
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

function createIntegrationApp() {
  const app = new Hono();

  app.route("/api/health", health);

  app.use("/api/w/:workspaceId/*", workspaceMiddleware);

  app.route("/api/w/:workspaceId/terminals", terminals);
  app.route("/api/w/:workspaceId/canvas", canvas);

  app.onError((err, c) => {
    if (err instanceof HTTPException) {
      return err.getResponse();
    }
    console.error("[test] Unhandled error:", err);
    return c.json({ error: "Internal Server Error" }, 500);
  });

  return app;
}

function seedWorkspace(db: TestDb, workspaceId = TEST_WORKSPACE_ID) {
  const now = new Date();
  db.insert(schema.workspace).values({
    id: workspaceId,
    name: "Integration Workspace",
    createdAt: now,
    lastAccessedAt: now,
  }).run();
}

function seedOnlineService(db: TestDb, workspaceId = TEST_WORKSPACE_ID) {
  const now = new Date();
  db.insert(schema.serviceInstance).values({
    id: "int-svc-row-1",
    workspaceId,
    serviceId: "int-svc-public-1",
    name: "Integration Service",
    apiKey: "int-test-key",
    status: "online",
    lastSeen: now,
    createdAt: now,
    updatedAt: now,
  }).run();
}

describe("Integration: Full HTTP API", () => {
  let db: TestDb;
  let app: ReturnType<typeof createIntegrationApp>;

  beforeEach(() => {
    uuidCounter = 0;
    db = createTestDb();
    mockGetDb.mockReset();
    mockGetDb.mockReturnValue(db);
    mockPublish.mockReset();
    mockPublish.mockResolvedValue(undefined);
    seedWorkspace(db);
    seedOnlineService(db);
    app = createIntegrationApp();
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  describe("GET /api/health", () => {
    it("returns 200 with status ok", async () => {
      const res = await app.request("/api/health");

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.status).toBe("ok");
      expect(body.serviceConnected).toBe(true);
      expect(body.connectedServices).toBe(1);
      expect(typeof body.timestamp).toBe("string");
    });
  });

  describe("Terminal CRUD flow", () => {
    it("supports the full create -> list -> delete lifecycle", async () => {
      const createRes = await app.request(`/api/w/${TEST_WORKSPACE_ID}/terminals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cols: 100, rows: 30, x: 50, y: 75 }),
      });

      expect(createRes.status).toBe(201);
      const createBody = await createRes.json();
      const terminalId = createBody.terminal.id;

      expect(createBody.terminal.status).toBe("active");
      expect(createBody.canvasNode.terminalSessionId).toBe(terminalId);
      expect(createBody.canvasNode.x).toBe(50);
      expect(createBody.canvasNode.y).toBe(75);
      expect(createBody.canvasNode.width).toBe(760);
      expect(createBody.canvasNode.height).toBe(480);

      const listRes = await app.request(`/api/w/${TEST_WORKSPACE_ID}/terminals`, {
        method: "GET",
      });

      expect(listRes.status).toBe(200);
      const listBody = await listRes.json();
      expect(listBody.terminals).toHaveLength(1);
      expect(listBody.terminals[0].id).toBe(terminalId);

      const deleteRes = await app.request(
        `/api/w/${TEST_WORKSPACE_ID}/terminals/${terminalId}`,
        { method: "DELETE" },
      );

      expect(deleteRes.status).toBe(200);
      const deleteBody = await deleteRes.json();
      expect(deleteBody.success).toBe(true);

      const listRes2 = await app.request(`/api/w/${TEST_WORKSPACE_ID}/terminals`, {
        method: "GET",
      });

      const listBody2 = await listRes2.json();
      expect(listBody2.terminals).toHaveLength(1);
      expect(listBody2.terminals[0].status).toBe("exited");
    });

    it("creates multiple terminals and lists them all", async () => {
      await app.request(`/api/w/${TEST_WORKSPACE_ID}/terminals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      await app.request(`/api/w/${TEST_WORKSPACE_ID}/terminals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const listRes = await app.request(`/api/w/${TEST_WORKSPACE_ID}/terminals`, {
        method: "GET",
      });
      const listBody = await listRes.json();
      expect(listBody.terminals).toHaveLength(2);
    });

    it("returns 404 when deleting a non-existent terminal", async () => {
      const res = await app.request(
        `/api/w/${TEST_WORKSPACE_ID}/terminals/nonexistent`,
        { method: "DELETE" },
      );
      expect(res.status).toBe(404);
    });
  });

  describe("Canvas node CRUD flow", () => {
    it("supports create terminal -> update node -> delete node", async () => {
      const createRes = await app.request(`/api/w/${TEST_WORKSPACE_ID}/terminals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ x: 100, y: 200 }),
      });

      expect(createRes.status).toBe(201);
      const createBody = await createRes.json();
      const nodeId = createBody.canvasNode.id;

      const listRes = await app.request(`/api/w/${TEST_WORKSPACE_ID}/canvas/nodes`, {
        method: "GET",
      });

      expect(listRes.status).toBe(200);
      const listBody = await listRes.json();
      expect(listBody.nodes).toHaveLength(1);
      expect(listBody.nodes[0].id).toBe(nodeId);

      const updatePosRes = await app.request(
        `/api/w/${TEST_WORKSPACE_ID}/canvas/nodes/${nodeId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ x: 300, y: 400 }),
        },
      );

      expect(updatePosRes.status).toBe(200);
      const updatePosBody = await updatePosRes.json();
      expect(updatePosBody.node.x).toBe(300);
      expect(updatePosBody.node.y).toBe(400);

      const updateDimRes = await app.request(
        `/api/w/${TEST_WORKSPACE_ID}/canvas/nodes/${nodeId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ width: 900, height: 700 }),
        },
      );

      expect(updateDimRes.status).toBe(200);
      const updateDimBody = await updateDimRes.json();
      expect(updateDimBody.node.width).toBe(900);
      expect(updateDimBody.node.height).toBe(700);
      expect(updateDimBody.node.x).toBe(300);
      expect(updateDimBody.node.y).toBe(400);

      const deleteRes = await app.request(
        `/api/w/${TEST_WORKSPACE_ID}/canvas/nodes/${nodeId}`,
        { method: "DELETE" },
      );

      expect(deleteRes.status).toBe(200);
      const deleteBody = await deleteRes.json();
      expect(deleteBody.success).toBe(true);

      const listRes2 = await app.request(`/api/w/${TEST_WORKSPACE_ID}/canvas/nodes`, {
        method: "GET",
      });
      const listBody2 = await listRes2.json();
      expect(listBody2.nodes).toHaveLength(0);
    });

    it("returns 404 when updating a non-existent node", async () => {
      const res = await app.request(
        `/api/w/${TEST_WORKSPACE_ID}/canvas/nodes/nonexistent`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ x: 100 }),
        },
      );
      expect(res.status).toBe(404);
    });

    it("returns 404 when deleting a non-existent node", async () => {
      const res = await app.request(
        `/api/w/${TEST_WORKSPACE_ID}/canvas/nodes/nonexistent`,
        { method: "DELETE" },
      );
      expect(res.status).toBe(404);
    });
  });

  describe("Cross-endpoint consistency", () => {
    it("canvas node references the correct terminal session", async () => {
      const createRes = await app.request(`/api/w/${TEST_WORKSPACE_ID}/terminals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const createBody = await createRes.json();
      const terminalId = createBody.terminal.id;

      const listRes = await app.request(`/api/w/${TEST_WORKSPACE_ID}/canvas/nodes`, {
        method: "GET",
      });
      const listBody = await listRes.json();

      expect(listBody.nodes).toHaveLength(1);
      expect(listBody.nodes[0].terminalSessionId).toBe(terminalId);
    });
  });
});
