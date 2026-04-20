import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Hono } from "hono";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { eq } from "drizzle-orm";
import * as schema from "../../src/db/schema.js";

// ─── Mocks ────────────────────────────────────────────────────────────────

// Mock uuid to return predictable IDs
let uuidCounter = 0;
vi.mock("uuid", () => ({
  v4: () => `test-uuid-${++uuidCounter}`,
}));

// Mock Redis publish
const mockPublish = vi.fn().mockResolvedValue(undefined);
vi.mock("../../src/lib/redis.js", () => ({
  publish: (...args: unknown[]) => mockPublish(...args),
}));

// Mock the db module — we'll override getDb per test
const mockGetDb = vi.fn();
vi.mock("../../src/db/index.js", () => ({
  getDb: () => mockGetDb(),
  schema,
}));

import { terminals } from "../../src/routes/terminals.js";

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

const TEST_TENANT_ID = "tenant-1";

function createApp(userId: string) {
  const app = new Hono();
  // Simulate auth middleware by setting userId and tenantId
  app.use("*", async (c, next) => {
    c.set("userId", userId);
    c.set("tenantId", TEST_TENANT_ID);
    await next();
  });
  app.route("/api/terminals", terminals);
  return app;
}

function seedTenant(db: ReturnType<typeof createTestDb>) {
  const now = new Date();
  db.insert(schema.tenant).values({
    id: TEST_TENANT_ID,
    name: "Test Tenant",
    slug: "test-tenant",
    createdAt: now,
    updatedAt: now,
  }).run();
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

function seedOnlineService(db: ReturnType<typeof createTestDb>) {
  const now = new Date();
  db.insert(schema.serviceInstance).values({
    id: "svc-1",
    tenantId: TEST_TENANT_ID,
    serviceId: "svc-id-1",
    name: "Test Service",
    apiKey: "test-key",
    status: "online",
    createdAt: now,
    updatedAt: now,
  }).run();
}

// ─── Tests ────────────────────────────────────────────────────────────────

describe("Terminal Sessions", () => {
  let db: ReturnType<typeof createTestDb>;

  beforeEach(() => {
    uuidCounter = 0;
    db = createTestDb();
    mockGetDb.mockReturnValue(db);
    mockPublish.mockClear();
    seedTenant(db);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("POST /api/terminals - Create a terminal session", () => {
    it("should create a terminal session and canvas node in the DB", async () => {
      const userId = "user-1";
      seedUser(db, userId);
      seedOnlineService(db);
      const app = createApp(userId);

      const res = await app.request("/api/terminals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cols: 120, rows: 40, x: 200, y: 300 }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();

      // Verify terminal was created
      expect(body.terminal).toBeDefined();
      expect(body.terminal.id).toBe("test-uuid-1");
      expect(body.terminal.userId).toBe(userId);
      expect(body.terminal.status).toBe("active");

      // Verify canvas node was created
      expect(body.canvasNode).toBeDefined();
      expect(body.canvasNode.id).toBe("test-uuid-2");
      expect(body.canvasNode.terminalSessionId).toBe("test-uuid-1");
      expect(body.canvasNode.x).toBe(200);
      expect(body.canvasNode.y).toBe(300);
      expect(body.canvasNode.width).toBe(600);
      expect(body.canvasNode.height).toBe(400);

      // Verify DB records exist
      const [dbTerminal] = await db
        .select()
        .from(schema.terminalSession)
        .where(eq(schema.terminalSession.id, "test-uuid-1"));
      expect(dbTerminal).toBeDefined();
      expect(dbTerminal.userId).toBe(userId);

      const [dbNode] = await db
        .select()
        .from(schema.canvasNode)
        .where(eq(schema.canvasNode.id, "test-uuid-2"));
      expect(dbNode).toBeDefined();
      expect(dbNode.terminalSessionId).toBe("test-uuid-1");
    });

    it("should publish a create command via Redis", async () => {
      const userId = "user-1";
      seedUser(db, userId);
      seedOnlineService(db);
      const app = createApp(userId);

      await app.request("/api/terminals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cols: 80, rows: 24 }),
      });

      expect(mockPublish).toHaveBeenCalledWith(
        "terminal:create",
        expect.objectContaining({
          terminalId: "test-uuid-1",
          tenantId: TEST_TENANT_ID,
          cols: 80,
          rows: 24,
        }),
      );
    });

    it("should use default cols/rows/x/y when not provided", async () => {
      const userId = "user-1";
      seedUser(db, userId);
      seedOnlineService(db);
      const app = createApp(userId);

      const res = await app.request("/api/terminals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.canvasNode.x).toBe(100);
      expect(body.canvasNode.y).toBe(100);

      expect(mockPublish).toHaveBeenCalledWith(
        "terminal:create",
        expect.objectContaining({ cols: 80, rows: 24 }),
      );
    });

    it("should return 503 when no online service is available", async () => {
      const userId = "user-1";
      seedUser(db, userId);
      // No online service seeded
      const app = createApp(userId);

      const res = await app.request("/api/terminals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(503);
    });
  });

  describe("GET /api/terminals - List terminals", () => {
    it("should return tenant terminals", async () => {
      const userId1 = "user-1";
      const userId2 = "user-2";
      seedUser(db, userId1);
      seedUser(db, userId2);
      const now = new Date();

      // Insert terminals for both users in the same tenant
      await db.insert(schema.terminalSession).values([
        { id: "t1", tenantId: TEST_TENANT_ID, userId: userId1, status: "active", createdAt: now, updatedAt: now },
        { id: "t2", tenantId: TEST_TENANT_ID, userId: userId1, status: "exited", createdAt: now, updatedAt: now },
        { id: "t3", tenantId: TEST_TENANT_ID, userId: userId2, status: "active", createdAt: now, updatedAt: now },
      ]);

      const app = createApp(userId1);
      const res = await app.request("/api/terminals", { method: "GET" });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.terminals.length).toBeGreaterThanOrEqual(1);
    });

    it("should return an empty list when tenant has no terminals", async () => {
      const userId = "user-1";
      seedUser(db, userId);
      const app = createApp(userId);

      const res = await app.request("/api/terminals", { method: "GET" });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.terminals).toHaveLength(0);
    });
  });

  describe("DELETE /api/terminals/:id - Delete a terminal", () => {
    it("should mark the terminal as exited and publish destroy via Redis", async () => {
      const userId = "user-1";
      seedUser(db, userId);
      seedOnlineService(db);
      const now = new Date();

      await db.insert(schema.terminalSession).values({
        id: "t1",
        tenantId: TEST_TENANT_ID,
        userId,
        status: "active",
        createdAt: now,
        updatedAt: now,
      });

      const app = createApp(userId);
      const res = await app.request("/api/terminals/t1", { method: "DELETE" });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);

      // Verify DB status updated
      const [updated] = await db
        .select()
        .from(schema.terminalSession)
        .where(eq(schema.terminalSession.id, "t1"));
      expect(updated.status).toBe("exited");

      // Verify destroy was published via Redis
      expect(mockPublish).toHaveBeenCalledWith(
        "terminal:destroy",
        expect.objectContaining({ terminalId: "t1" }),
      );
    });

    it("should return 404 when terminal does not exist", async () => {
      const userId = "user-1";
      seedUser(db, userId);
      const app = createApp(userId);

      const res = await app.request("/api/terminals/nonexistent", { method: "DELETE" });

      expect(res.status).toBe(404);
    });

    it("should return 404 when trying to delete another user's terminal", async () => {
      const userId1 = "user-1";
      const userId2 = "user-2";
      seedUser(db, userId1);
      seedUser(db, userId2);
      const now = new Date();

      await db.insert(schema.terminalSession).values({
        id: "t1",
        tenantId: TEST_TENANT_ID,
        userId: userId2,
        status: "active",
        createdAt: now,
        updatedAt: now,
      });

      const app = createApp(userId1);
      const res = await app.request("/api/terminals/t1", { method: "DELETE" });

      expect(res.status).toBe(404);
    });

    it("should not publish destroy if terminal is already exited", async () => {
      const userId = "user-1";
      seedUser(db, userId);
      const now = new Date();

      await db.insert(schema.terminalSession).values({
        id: "t1",
        tenantId: TEST_TENANT_ID,
        userId,
        status: "exited",
        createdAt: now,
        updatedAt: now,
      });

      const app = createApp(userId);
      await app.request("/api/terminals/t1", { method: "DELETE" });

      expect(mockPublish).not.toHaveBeenCalled();
    });
  });
});
