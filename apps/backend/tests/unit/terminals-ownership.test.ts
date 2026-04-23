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

function createApp() {
  const app = new Hono();
  app.use("*", async (c, next) => {
    c.set("workspaceId", "ws-1");
    await next();
  });
  app.route("/api/terminals", terminals);
  return app;
}

function seedWorkspace(db: ReturnType<typeof createTestDb>) {
  const now = new Date();
  db.insert(schema.workspace).values({
    id: "ws-1",
    name: "Workspace",
    createdAt: now,
    lastAccessedAt: now,
  }).run();
}

function seedService(db: ReturnType<typeof createTestDb>) {
  const now = new Date();
  db.insert(schema.serviceInstance).values({
    id: "svc-row-1",
    workspaceId: "ws-1",
    serviceId: "svc-public-1",
    name: "Service 1",
    apiKey: "api-key",
    status: "online",
    lastSeen: now,
    createdAt: now,
    updatedAt: now,
  }).run();
}

describe("terminal service ownership", () => {
  beforeEach(() => {
    uuidCounter = 0;
    mockPublish.mockClear();
  });

  it("persists the owning service when creating a terminal", async () => {
    const db = createTestDb();
    mockGetDb.mockReturnValue(db);
    seedWorkspace(db);
    seedService(db);

    const app = createApp();
    const res = await app.request("/api/terminals", { method: "POST" });

    expect(res.status).toBe(201);

    const [terminal] = await db
      .select()
      .from(schema.terminalSession)
      .where(eq(schema.terminalSession.id, "test-uuid-1"));

    expect(terminal.serviceInstanceId).toBe("svc-row-1");
    expect(mockPublish).toHaveBeenCalledWith(
      "terminal:commands",
      expect.objectContaining({
        command: "terminal:create",
        terminalId: "test-uuid-1",
        serviceInstanceId: "svc-public-1",
      }),
    );
  });

  it("routes destroy to the owning service", async () => {
    const db = createTestDb();
    mockGetDb.mockReturnValue(db);
    seedWorkspace(db);
    seedService(db);

    const now = new Date();
    db.insert(schema.terminalSession).values({
      id: "terminal-1",
      workspaceId: "ws-1",
      serviceInstanceId: "svc-row-1",
      status: "active",
      createdAt: now,
      updatedAt: now,
    }).run();

    const app = createApp();
    const res = await app.request("/api/terminals/terminal-1", { method: "DELETE" });

    expect(res.status).toBe(200);
    expect(mockPublish).toHaveBeenCalledWith(
      "terminal:commands",
      expect.objectContaining({
        command: "terminal:destroy",
        terminalId: "terminal-1",
        serviceInstanceId: "svc-public-1",
      }),
    );
  });
});
