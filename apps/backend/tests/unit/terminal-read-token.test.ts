import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { eq } from "drizzle-orm";
import * as schema from "../../src/db/schema.js";

let uuidCounter = 0;
vi.spyOn(crypto, "randomUUID").mockImplementation(
  () => `test-uuid-${++uuidCounter}` as `${string}-${string}-${string}-${string}-${string}`,
);

const mockPublish = vi.fn().mockResolvedValue(undefined);
const mockLrange = vi.fn();
vi.mock("../../src/lib/redis.js", () => ({
  publish: (...args: unknown[]) => mockPublish(...args),
  getPublisher: () => ({ lrange: (...args: unknown[]) => mockLrange(...args) }),
}));

const mockGetDb = vi.fn();
vi.mock("../../src/db/index.js", () => ({
  getDb: () => mockGetDb(),
  schema,
}));

import { terminals } from "../../src/routes/terminals.js";
import { terminalsPublic } from "../../src/routes/terminals-public.js";

function createTestDb() {
  const sqlite = new Database(":memory:");
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.exec(`
    CREATE TABLE "workspace" (
      "id" text PRIMARY KEY NOT NULL,
      "name" text NOT NULL DEFAULT '',
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
  `);
  return drizzle(sqlite, { schema });
}

function workspaceApp(workspaceId = "ws-1") {
  const app = new Hono();
  app.use("*", async (c, next) => {
    c.set("workspaceId", workspaceId);
    await next();
  });
  app.route("/api/w/:workspaceId/terminals", terminals);
  return app;
}

function publicApp() {
  const app = new Hono();
  app.route("/api/terminals", terminalsPublic);
  return app;
}

function seedWorkspace(db: ReturnType<typeof createTestDb>, id = "ws-1") {
  const now = new Date();
  db.insert(schema.workspace).values({ id, name: "ws", createdAt: now, lastAccessedAt: now }).run();
}

function seedTerminal(
  db: ReturnType<typeof createTestDb>,
  id = "term-1",
  workspaceId = "ws-1",
  readToken = "secret-1",
) {
  const now = new Date();
  db.insert(schema.terminalSession).values({
    id,
    workspaceId,
    tags: "",
    status: "active",
    readToken,
    createdAt: now,
    updatedAt: now,
  }).run();
}

describe("Terminal read tokens", () => {
  let db: ReturnType<typeof createTestDb>;

  beforeEach(() => {
    uuidCounter = 0;
    db = createTestDb();
    mockGetDb.mockReset();
    mockGetDb.mockReturnValue(db);
    mockPublish.mockReset();
    mockPublish.mockResolvedValue(undefined);
    mockLrange.mockReset();
    mockLrange.mockResolvedValue([]);
  });

  describe("POST /api/w/:wsId/terminals/:id/rotate-read-token", () => {
    it("rotates the read token", async () => {
      seedWorkspace(db);
      seedTerminal(db, "term-1", "ws-1", "old-token");
      const app = workspaceApp();

      const res = await app.request("/api/w/ws-1/terminals/term-1/rotate-read-token", {
        method: "POST",
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.terminal.id).toBe("term-1");
      expect(body.terminal.readToken).toBe("test-uuid-1");
      expect(body.terminal.readToken).not.toBe("old-token");

      const [row] = await db
        .select()
        .from(schema.terminalSession)
        .where(eq(schema.terminalSession.id, "term-1"));
      expect(row.readToken).toBe("test-uuid-1");
    });

    it("returns 404 for unknown terminal", async () => {
      seedWorkspace(db);
      const app = workspaceApp();

      const res = await app.request("/api/w/ws-1/terminals/missing/rotate-read-token", {
        method: "POST",
      });

      expect(res.status).toBe(404);
    });

    it("returns 404 if terminal belongs to a different workspace", async () => {
      seedWorkspace(db);
      seedWorkspace(db, "ws-2");
      seedTerminal(db, "term-other", "ws-2", "secret-other");
      const app = workspaceApp("ws-1");

      const res = await app.request("/api/w/ws-1/terminals/term-other/rotate-read-token", {
        method: "POST",
      });

      expect(res.status).toBe(404);
    });
  });

  describe("GET /api/terminals/:id/output (public)", () => {
    it("returns 200 with token-authenticated request", async () => {
      seedWorkspace(db);
      seedTerminal(db, "term-1", "ws-1", "secret-1");
      mockLrange.mockResolvedValueOnce(["hello\n", "world\n"]);
      const app = publicApp();

      const res = await app.request("/api/terminals/term-1/output", {
        headers: { "X-Terminal-Read-Token": "secret-1" },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.terminalId).toBe("term-1");
      expect(body.lines).toEqual(["hello", "world", ""]);
      expect(typeof body.capturedAt).toBe("string");
    });

    it("rejects with 401 on wrong token", async () => {
      seedWorkspace(db);
      seedTerminal(db, "term-1", "ws-1", "secret-1");
      const app = publicApp();

      const res = await app.request("/api/terminals/term-1/output", {
        headers: { "X-Terminal-Read-Token": "WRONG" },
      });

      expect(res.status).toBe(401);
    });

    it("rejects with 401 when token header is missing", async () => {
      seedWorkspace(db);
      seedTerminal(db, "term-1", "ws-1", "secret-1");
      const app = publicApp();

      const res = await app.request("/api/terminals/term-1/output");

      expect(res.status).toBe(401);
    });

    it("returns 404 for unknown terminal id", async () => {
      const app = publicApp();

      const res = await app.request("/api/terminals/missing/output", {
        headers: { "X-Terminal-Read-Token": "anything" },
      });

      expect(res.status).toBe(404);
    });

    it("clamps lines parameter to MAX (1000)", async () => {
      seedWorkspace(db);
      seedTerminal(db, "term-1", "ws-1", "secret-1");
      const fakeLines = Array.from({ length: 1500 }, (_, i) => `line${i}\n`);
      mockLrange.mockResolvedValueOnce(fakeLines);
      const app = publicApp();

      const res = await app.request("/api/terminals/term-1/output?lines=2000", {
        headers: { "X-Terminal-Read-Token": "secret-1" },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      // Concatenated then split by \n: 1500 fake lines + 1 trailing empty = 1501, tail to 1000.
      expect(body.lines.length).toBe(1000);
    });

    it("defaults to 200 lines when lines param is invalid or missing", async () => {
      seedWorkspace(db);
      seedTerminal(db, "term-1", "ws-1", "secret-1");
      const fakeLines = Array.from({ length: 500 }, (_, i) => `line${i}\n`);
      mockLrange.mockResolvedValueOnce(fakeLines);
      const app = publicApp();

      const res = await app.request("/api/terminals/term-1/output?lines=-5", {
        headers: { "X-Terminal-Read-Token": "secret-1" },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.lines.length).toBe(200);
    });

    it("returns at most N lines when lines=N is in range", async () => {
      seedWorkspace(db);
      seedTerminal(db, "term-1", "ws-1", "secret-1");
      const fakeLines = Array.from({ length: 50 }, (_, i) => `L${i}\n`);
      mockLrange.mockResolvedValueOnce(fakeLines);
      const app = publicApp();

      const res = await app.request("/api/terminals/term-1/output?lines=10", {
        headers: { "X-Terminal-Read-Token": "secret-1" },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.lines.length).toBe(10);
      // Tail should be the last 10 entries (post-newline split adds a trailing "")
      expect(body.lines).toEqual([
        "L41", "L42", "L43", "L44", "L45", "L46", "L47", "L48", "L49", "",
      ]);
    });

    it("strips Windows CR before splitting on LF", async () => {
      seedWorkspace(db);
      seedTerminal(db, "term-1", "ws-1", "secret-1");
      mockLrange.mockResolvedValueOnce(["one\r\ntwo\r\n"]);
      const app = publicApp();

      const res = await app.request("/api/terminals/term-1/output", {
        headers: { "X-Terminal-Read-Token": "secret-1" },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.lines).toEqual(["one", "two", ""]);
    });

    it("rejects token from a different terminal (no cross-terminal access)", async () => {
      seedWorkspace(db);
      seedTerminal(db, "term-A", "ws-1", "secret-A");
      seedTerminal(db, "term-B", "ws-1", "secret-B");
      const app = publicApp();

      const res = await app.request("/api/terminals/term-A/output", {
        headers: { "X-Terminal-Read-Token": "secret-B" },
      });

      expect(res.status).toBe(401);
    });
  });
});
