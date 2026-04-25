import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema.js";
import { getEnv } from "../env.js";

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;
let _sqlite: Database.Database | null = null;

// SQLite UUID v4 generator. Used to backfill new tokenized columns on existing rows.
const RANDOM_UUID_SQL = `lower(
  hex(randomblob(4)) || '-' ||
  hex(randomblob(2)) || '-4' ||
  substr(hex(randomblob(2)),2) || '-' ||
  substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' ||
  hex(randomblob(6))
)`;

export function initializeDb() {
  const env = getEnv();
  _sqlite = new Database(env.DATABASE_URL);

  // Enable WAL mode for better concurrent read performance
  _sqlite.pragma("journal_mode = WAL");
  _sqlite.pragma("foreign_keys = ON");

  // Create tables if they don't exist
  _sqlite.exec(`
    CREATE TABLE IF NOT EXISTS "workspace" (
      "id" text PRIMARY KEY NOT NULL,
      "name" text NOT NULL DEFAULT 'Untitled workspace',
      "apiKey" text NOT NULL DEFAULT '',
      "createdAt" integer NOT NULL DEFAULT (unixepoch()),
      "lastAccessedAt" integer NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS "service_instance" (
      "id" text PRIMARY KEY NOT NULL,
      "workspaceId" text NOT NULL REFERENCES "workspace"("id") ON DELETE CASCADE,
      "serviceId" text NOT NULL,
      "name" text NOT NULL,
      "apiKey" text NOT NULL,
      "whitelistedPaths" text,
      "lastSeen" integer,
      "status" text DEFAULT 'offline',
      "createdAt" integer NOT NULL DEFAULT (unixepoch()),
      "updatedAt" integer NOT NULL DEFAULT (unixepoch())
    );
    CREATE UNIQUE INDEX IF NOT EXISTS "service_instance_workspace_service_unique"
      ON "service_instance"("workspaceId", "serviceId");

    CREATE TABLE IF NOT EXISTS "note" (
      "id" text PRIMARY KEY NOT NULL,
      "workspaceId" text NOT NULL REFERENCES "workspace"("id") ON DELETE CASCADE,
      "content" text DEFAULT '',
      "createdAt" integer NOT NULL DEFAULT (unixepoch()),
      "updatedAt" integer NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS "chat_message" (
      "id" text PRIMARY KEY NOT NULL,
      "workspaceId" text NOT NULL REFERENCES "workspace"("id") ON DELETE CASCADE,
      "displayName" text NOT NULL DEFAULT 'Anonymous',
      "content" text NOT NULL,
      "createdAt" integer NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS "terminal_session" (
      "id" text PRIMARY KEY NOT NULL,
      "workspaceId" text NOT NULL REFERENCES "workspace"("id") ON DELETE CASCADE,
      "serviceInstanceId" text REFERENCES "service_instance"("id") ON DELETE SET NULL,
      "tags" text DEFAULT '',
      "status" text NOT NULL DEFAULT 'active',
      "exitCode" integer,
      "createdAt" integer NOT NULL DEFAULT (unixepoch()),
      "updatedAt" integer NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS "screenshot" (
      "id" text PRIMARY KEY NOT NULL,
      "workspaceId" text NOT NULL REFERENCES "workspace"("id") ON DELETE CASCADE,
      "serviceInstanceId" text REFERENCES "service_instance"("id") ON DELETE SET NULL,
      "imageData" text NOT NULL,
      "monitorIndex" integer NOT NULL DEFAULT 0,
      "width" integer NOT NULL DEFAULT 0,
      "height" integer NOT NULL DEFAULT 0,
      "capturedAt" integer NOT NULL DEFAULT (unixepoch()),
      "createdAt" integer NOT NULL DEFAULT (unixepoch()),
      "updatedAt" integer NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS "canvas_node" (
      "id" text PRIMARY KEY NOT NULL,
      "workspaceId" text NOT NULL REFERENCES "workspace"("id") ON DELETE CASCADE,
      "terminalSessionId" text REFERENCES "terminal_session"("id") ON DELETE SET NULL,
      "nodeType" text NOT NULL DEFAULT 'terminal',
      "noteId" text REFERENCES "note"("id") ON DELETE SET NULL,
      "screenshotId" text REFERENCES "screenshot"("id") ON DELETE SET NULL,
      "serviceInstanceId" text REFERENCES "service_instance"("id") ON DELETE SET NULL,
      "x" real NOT NULL DEFAULT 100,
      "y" real NOT NULL DEFAULT 100,
      "width" real NOT NULL DEFAULT 600,
      "height" real NOT NULL DEFAULT 400,
      "zIndex" integer NOT NULL DEFAULT 0,
      "createdAt" integer NOT NULL DEFAULT (unixepoch()),
      "updatedAt" integer NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS "canvas_edge" (
      "id" text PRIMARY KEY NOT NULL,
      "workspaceId" text NOT NULL REFERENCES "workspace"("id") ON DELETE CASCADE,
      "sourceNodeId" text NOT NULL REFERENCES "canvas_node"("id") ON DELETE CASCADE,
      "targetNodeId" text NOT NULL REFERENCES "canvas_node"("id") ON DELETE CASCADE,
      "createdAt" integer NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS "command_history" (
      "id" text PRIMARY KEY NOT NULL,
      "workspaceId" text NOT NULL REFERENCES "workspace"("id") ON DELETE CASCADE,
      "terminalSessionId" text NOT NULL REFERENCES "terminal_session"("id") ON DELETE CASCADE,
      "command" text NOT NULL,
      "executedAt" integer NOT NULL DEFAULT (unixepoch()),
      "createdAt" integer NOT NULL DEFAULT (unixepoch())
    );

    CREATE INDEX IF NOT EXISTS "idx_command_history_ws_terminal"
      ON "command_history"("workspaceId", "terminalSessionId");

    CREATE TABLE IF NOT EXISTS "trigger" (
      "id" text PRIMARY KEY NOT NULL,
      "workspaceId" text NOT NULL REFERENCES "workspace"("id") ON DELETE CASCADE,
      "terminalNodeId" text NOT NULL REFERENCES "canvas_node"("id") ON DELETE CASCADE,
      "terminalSessionId" text NOT NULL REFERENCES "terminal_session"("id") ON DELETE CASCADE,
      "type" text NOT NULL,
      "enabled" integer NOT NULL DEFAULT 0,
      "config" text NOT NULL DEFAULT '{}',
      "lastFiredAt" integer,
      "lastError" text,
      "createdAt" integer NOT NULL DEFAULT (unixepoch()),
      "updatedAt" integer NOT NULL DEFAULT (unixepoch())
    );
    CREATE UNIQUE INDEX IF NOT EXISTS "trigger_terminal_type_unique"
      ON "trigger"("terminalNodeId", "type");
  `);

  try {
    _sqlite.exec(`ALTER TABLE "canvas_node" ADD COLUMN "triggerId" text`);
  } catch {
    // Column already exists
  }

  try {
    _sqlite.exec(`ALTER TABLE "terminal_session" ADD COLUMN "readToken" text NOT NULL DEFAULT ''`);
  } catch {
    // Column already exists
  }

  // Backfill read tokens for existing rows (safe to re-run; only touches blanks)
  _sqlite.exec(
    `UPDATE "terminal_session" SET "readToken" = ${RANDOM_UUID_SQL} WHERE "readToken" = ''`,
  );

  // Migrations for existing databases
  try {
    _sqlite.exec(`ALTER TABLE "terminal_session" ADD COLUMN "tags" text DEFAULT ''`);
  } catch {
    // Column already exists
  }
  try {
    _sqlite.exec(`ALTER TABLE "canvas_node" ADD COLUMN "screenshotId" text REFERENCES "screenshot"("id") ON DELETE SET NULL`);
  } catch {
    // Column already exists
  }
  try {
    _sqlite.exec(`ALTER TABLE "canvas_node" ADD COLUMN "serviceInstanceId" text REFERENCES "service_instance"("id") ON DELETE SET NULL`);
  } catch {
    // Column already exists
  }

  // Backfill serviceInstanceId on legacy screenshot canvas nodes so the
  // host-delete cascade can reach them. Safe to re-run: it only touches rows
  // where the column is still NULL but the linked screenshot knows its host.
  _sqlite.exec(`
    UPDATE "canvas_node"
    SET "serviceInstanceId" = (
      SELECT "serviceInstanceId" FROM "screenshot"
      WHERE "screenshot"."id" = "canvas_node"."screenshotId"
    )
    WHERE "nodeType" = 'screenshot'
      AND "serviceInstanceId" IS NULL
      AND "screenshotId" IS NOT NULL
  `);
  try {
    _sqlite.exec(`ALTER TABLE "workspace" ADD COLUMN "apiKey" text NOT NULL DEFAULT ''`);
    // Backfill existing workspaces with generated UUIDs (only runs once, when column is first added)
    _sqlite.exec(`UPDATE "workspace" SET "apiKey" = ${RANDOM_UUID_SQL} WHERE "apiKey" = ''`);
  } catch {
    // Column already exists
  }

  // Rebuild service_instance if it still has the legacy column-level UNIQUE on serviceId.
  // Older rows may have been "locked" under one workspace, making the same serviceId
  // unable to appear in other workspaces even though each (workspaceId, serviceId) pair
  // is what actually identifies an agent registration.
  const serviceInstanceDdl = _sqlite
    .prepare(`SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'service_instance'`)
    .get() as { sql?: string } | undefined;
  if (serviceInstanceDdl?.sql && /"serviceId"\s+text\s+NOT\s+NULL\s+UNIQUE/i.test(serviceInstanceDdl.sql)) {
    console.log("[db] Migrating service_instance: dropping global UNIQUE on serviceId");
    _sqlite.pragma("foreign_keys = OFF");
    _sqlite.exec(`
      BEGIN;
      CREATE TABLE "service_instance__new" (
        "id" text PRIMARY KEY NOT NULL,
        "workspaceId" text NOT NULL REFERENCES "workspace"("id") ON DELETE CASCADE,
        "serviceId" text NOT NULL,
        "name" text NOT NULL,
        "apiKey" text NOT NULL,
        "whitelistedPaths" text,
        "lastSeen" integer,
        "status" text DEFAULT 'offline',
        "createdAt" integer NOT NULL DEFAULT (unixepoch()),
        "updatedAt" integer NOT NULL DEFAULT (unixepoch())
      );
      INSERT INTO "service_instance__new"
        SELECT "id", "workspaceId", "serviceId", "name", "apiKey", "whitelistedPaths",
               "lastSeen", "status", "createdAt", "updatedAt"
        FROM "service_instance";
      DROP TABLE "service_instance";
      ALTER TABLE "service_instance__new" RENAME TO "service_instance";
      CREATE UNIQUE INDEX "service_instance_workspace_service_unique"
        ON "service_instance"("workspaceId", "serviceId");
      COMMIT;
    `);
    _sqlite.pragma("foreign_keys = ON");
  }

  // Flip legacy terminal→host edges to host→terminal so they render from the
  // host's bottom handle. Idempotent: after the swap no such edges remain.
  _sqlite.exec(`
    UPDATE "canvas_edge"
    SET "sourceNodeId" = "targetNodeId", "targetNodeId" = "sourceNodeId"
    WHERE "id" IN (
      SELECT e."id"
      FROM "canvas_edge" e
      JOIN "canvas_node" s ON s."id" = e."sourceNodeId"
      JOIN "canvas_node" t ON t."id" = e."targetNodeId"
      WHERE s."nodeType" = 'terminal' AND t."nodeType" = 'host'
    )
  `);

  // Drop trigger canvas nodes whose underlying trigger row no longer exists.
  // These can appear when a parent terminal is dismissed: the trigger row is
  // FK-cascaded out, but its canvas_node lingers (no FK on canvas_node.triggerId).
  _sqlite.exec(`
    DELETE FROM "canvas_node"
    WHERE "nodeType" = 'trigger'
      AND ("triggerId" IS NULL OR "triggerId" NOT IN (SELECT "id" FROM "trigger"))
  `);

  _db = drizzle(_sqlite, { schema });

  console.log("[db] Database initialized:", env.DATABASE_URL);
  return _db;
}

export function getDb() {
  if (!_db) {
    throw new Error("Database not initialized. Call initializeDb() first.");
  }
  return _db;
}

export * as schema from "./schema.js";
