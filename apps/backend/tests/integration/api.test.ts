import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import { Hono } from "hono";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "../../src/db/schema.js";

// ─── Mocks ────────────────────────────────────────────────────────────────

let uuidCounter = 0;
vi.mock("uuid", () => ({
  v4: () => `int-uuid-${++uuidCounter}`,
}));

// Mock Redis publish
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

// ─── Helpers ──────────────────────────────────────────────────────────────

type TestDb = ReturnType<typeof drizzle<typeof schema>>;

const TEST_TENANT_ID = "int-tenant-1";

function createTestDb(): TestDb {
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
    CREATE TABLE "tenant" (
      "id" text PRIMARY KEY NOT NULL,
      "name" text NOT NULL,
      "slug" text NOT NULL UNIQUE,
      "createdAt" integer NOT NULL DEFAULT (unixepoch()),
      "updatedAt" integer NOT NULL DEFAULT (unixepoch())
    );
    CREATE TABLE "service_instance" (
      "id" text PRIMARY KEY NOT NULL,
      "tenantId" text NOT NULL REFERENCES "tenant"("id") ON DELETE CASCADE,
      "serviceId" text NOT NULL UNIQUE,
      "name" text NOT NULL,
      "apiKey" text NOT NULL,
      "whitelistedPaths" text,
      "lastSeen" integer,
      "status" text DEFAULT 'offline',
      "createdAt" integer NOT NULL DEFAULT (unixepoch()),
      "updatedAt" integer NOT NULL DEFAULT (unixepoch())
    );
    CREATE TABLE "terminal_session" (
      "id" text PRIMARY KEY NOT NULL,
      "tenantId" text NOT NULL REFERENCES "tenant"("id") ON DELETE CASCADE,
      "userId" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
      "serviceInstanceId" text REFERENCES "service_instance"("id") ON DELETE SET NULL,
      "status" text NOT NULL DEFAULT 'active',
      "exitCode" integer,
      "createdAt" integer NOT NULL DEFAULT (unixepoch()),
      "updatedAt" integer NOT NULL DEFAULT (unixepoch())
    );
    CREATE TABLE "canvas_node" (
      "id" text PRIMARY KEY NOT NULL,
      "tenantId" text NOT NULL REFERENCES "tenant"("id") ON DELETE CASCADE,
      "terminalSessionId" text REFERENCES "terminal_session"("id") ON DELETE SET NULL,
      "userId" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
      "nodeType" text NOT NULL DEFAULT 'terminal',
      "noteId" text,
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

const TEST_USER_ID = "integration-user-1";

function createIntegrationApp(db: TestDb) {
  const app = new Hono();

  // Health is public (no auth)
  app.route("/api/health", health);

  // Simulate auth middleware for protected routes
  const protectedMiddleware = async (c: any, next: any) => {
    c.set("userId", TEST_USER_ID);
    c.set("tenantId", TEST_TENANT_ID);
    await next();
  };
  app.use("/api/terminals/*", protectedMiddleware);
  app.use("/api/terminals", protectedMiddleware);
  app.use("/api/canvas/*", protectedMiddleware);

  app.route("/api/terminals", terminals);
  app.route("/api/canvas", canvas);

  // Error handler matching the real app
  app.onError((err, c) => {
    if ("getResponse" in err && typeof err.getResponse === "function") {
      throw err;
    }
    console.error("[test] Unhandled error:", err);
    return c.json({ error: "Internal Server Error" }, 500);
  });

  return app;
}

function seedUser(db: TestDb, userId: string) {
  const now = new Date();
  db.insert(schema.user).values({
    id: userId,
    name: "Integration Test User",
    email: `${userId}@integration.test`,
    emailVerified: false,
    createdAt: now,
    updatedAt: now,
  }).run();
}

function seedTenant(db: TestDb) {
  const now = new Date();
  db.insert(schema.tenant).values({
    id: TEST_TENANT_ID,
    name: "Integration Tenant",
    slug: "integration-tenant",
    createdAt: now,
    updatedAt: now,
  }).run();
}

function seedOnlineService(db: TestDb) {
  const now = new Date();
  db.insert(schema.serviceInstance).values({
    id: "int-svc-1",
    tenantId: TEST_TENANT_ID,
    serviceId: "int-svc-id-1",
    name: "Integration Service",
    apiKey: "int-test-key",
    status: "online",
    createdAt: now,
    updatedAt: now,
  }).run();
}

// ─── Tests ────────────────────────────────────────────────────────────────

describe("Integration: Full HTTP API", () => {
  let db: TestDb;
  let app: ReturnType<typeof createIntegrationApp>;

  beforeEach(() => {
    uuidCounter = 0;
    db = createTestDb();
    mockGetDb.mockReturnValue(db);
    mockPublish.mockClear();
    seedTenant(db);
    seedUser(db, TEST_USER_ID);
    seedOnlineService(db);
    app = createIntegrationApp(db);
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  // ─── Health ───────────────────────────────────────────────────────────

  describe("GET /api/health", () => {
    it("should return 200 with status ok", async () => {
      const res = await app.request("/api/health");

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.status).toBe("ok");
      expect(typeof body.serviceConnected).toBe("boolean");
      expect(typeof body.timestamp).toBe("string");
    });
  });

  // ─── Terminal CRUD Flow ───────────────────────────────────────────────

  describe("Terminal CRUD flow", () => {
    it("should support the full create -> list -> delete lifecycle", async () => {
      // Step 1: Create a terminal
      const createRes = await app.request("/api/terminals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cols: 100, rows: 30, x: 50, y: 75 }),
      });

      expect(createRes.status).toBe(201);
      const createBody = await createRes.json();
      const terminalId = createBody.terminal.id;
      const canvasNodeId = createBody.canvasNode.id;

      expect(createBody.terminal.status).toBe("active");
      expect(createBody.terminal.userId).toBe(TEST_USER_ID);
      expect(createBody.canvasNode.terminalSessionId).toBe(terminalId);
      expect(createBody.canvasNode.x).toBe(50);
      expect(createBody.canvasNode.y).toBe(75);

      // Step 2: List terminals - should include the created one
      const listRes = await app.request("/api/terminals", { method: "GET" });

      expect(listRes.status).toBe(200);
      const listBody = await listRes.json();
      expect(listBody.terminals).toHaveLength(1);
      expect(listBody.terminals[0].id).toBe(terminalId);

      // Step 3: Delete the terminal
      const deleteRes = await app.request(`/api/terminals/${terminalId}`, { method: "DELETE" });

      expect(deleteRes.status).toBe(200);
      const deleteBody = await deleteRes.json();
      expect(deleteBody.success).toBe(true);

      // Step 4: List again - terminal should still be there but with exited status
      const listRes2 = await app.request("/api/terminals", { method: "GET" });

      const listBody2 = await listRes2.json();
      expect(listBody2.terminals).toHaveLength(1);
      expect(listBody2.terminals[0].status).toBe("exited");
    });

    it("should create multiple terminals and list them all", async () => {
      // Create first terminal
      await app.request("/api/terminals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      // Create second terminal
      await app.request("/api/terminals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const listRes = await app.request("/api/terminals", { method: "GET" });
      const listBody = await listRes.json();
      expect(listBody.terminals).toHaveLength(2);
    });

    it("should return 404 when deleting a non-existent terminal", async () => {
      const res = await app.request("/api/terminals/nonexistent", { method: "DELETE" });
      expect(res.status).toBe(404);
    });
  });

  // ─── Canvas Node CRUD Flow ────────────────────────────────────────────

  describe("Canvas Node CRUD flow", () => {
    it("should support the full create terminal (with node) -> update node -> delete node lifecycle", async () => {
      // Step 1: Create terminal (which also creates a canvas node)
      const createRes = await app.request("/api/terminals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ x: 100, y: 200 }),
      });

      expect(createRes.status).toBe(201);
      const createBody = await createRes.json();
      const nodeId = createBody.canvasNode.id;

      // Step 2: List canvas nodes
      const listRes = await app.request("/api/canvas/nodes", { method: "GET" });

      expect(listRes.status).toBe(200);
      const listBody = await listRes.json();
      expect(listBody.nodes).toHaveLength(1);
      expect(listBody.nodes[0].id).toBe(nodeId);

      // Step 3: Update position
      const updatePosRes = await app.request(`/api/canvas/nodes/${nodeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ x: 300, y: 400 }),
      });

      expect(updatePosRes.status).toBe(200);
      const updatePosBody = await updatePosRes.json();
      expect(updatePosBody.node.x).toBe(300);
      expect(updatePosBody.node.y).toBe(400);

      // Step 4: Update dimensions
      const updateDimRes = await app.request(`/api/canvas/nodes/${nodeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ width: 900, height: 700 }),
      });

      expect(updateDimRes.status).toBe(200);
      const updateDimBody = await updateDimRes.json();
      expect(updateDimBody.node.width).toBe(900);
      expect(updateDimBody.node.height).toBe(700);
      // Previous update should be preserved
      expect(updateDimBody.node.x).toBe(300);
      expect(updateDimBody.node.y).toBe(400);

      // Step 5: Delete node
      const deleteRes = await app.request(`/api/canvas/nodes/${nodeId}`, { method: "DELETE" });

      expect(deleteRes.status).toBe(200);
      const deleteBody = await deleteRes.json();
      expect(deleteBody.success).toBe(true);

      // Step 6: Verify node is gone
      const listRes2 = await app.request("/api/canvas/nodes", { method: "GET" });
      const listBody2 = await listRes2.json();
      expect(listBody2.nodes).toHaveLength(0);
    });

    it("should return 404 when updating a non-existent node", async () => {
      const res = await app.request("/api/canvas/nodes/nonexistent", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ x: 100 }),
      });
      expect(res.status).toBe(404);
    });

    it("should return 404 when deleting a non-existent node", async () => {
      const res = await app.request("/api/canvas/nodes/nonexistent", { method: "DELETE" });
      expect(res.status).toBe(404);
    });
  });

  // ─── Cross-endpoint consistency ───────────────────────────────────────

  describe("Cross-endpoint consistency", () => {
    it("canvas node references the correct terminal session", async () => {
      const createRes = await app.request("/api/terminals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const createBody = await createRes.json();
      const terminalId = createBody.terminal.id;

      const listRes = await app.request("/api/canvas/nodes", { method: "GET" });
      const listBody = await listRes.json();

      expect(listBody.nodes).toHaveLength(1);
      expect(listBody.nodes[0].terminalSessionId).toBe(terminalId);
    });
  });
});
