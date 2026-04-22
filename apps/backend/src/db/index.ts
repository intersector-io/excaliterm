import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema.js";
import { getEnv } from "../env.js";

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;
let _sqlite: Database.Database | null = null;

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
      "serviceId" text NOT NULL UNIQUE,
      "name" text NOT NULL,
      "apiKey" text NOT NULL,
      "whitelistedPaths" text,
      "lastSeen" integer,
      "status" text DEFAULT 'offline',
      "createdAt" integer NOT NULL DEFAULT (unixepoch()),
      "updatedAt" integer NOT NULL DEFAULT (unixepoch())
    );

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
  `);

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
  try {
    _sqlite.exec(`ALTER TABLE "workspace" ADD COLUMN "apiKey" text NOT NULL DEFAULT ''`);
    // Backfill existing workspaces with generated UUIDs (only runs once, when column is first added)
    _sqlite.exec(`UPDATE "workspace" SET "apiKey" = lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6))) WHERE "apiKey" = ''`);
  } catch {
    // Column already exists
  }

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

export { schema } from "./schema.js";
