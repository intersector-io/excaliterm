import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { sql, type InferSelectModel, type InferInsertModel } from "drizzle-orm";

// ─── Workspace ────────────────────────────────────────────────────────────

export const workspace = sqliteTable("workspace", {
  id: text("id").primaryKey(),
  name: text("name").notNull().default("Untitled workspace"),
  apiKey: text("apiKey").notNull().default(""),
  createdAt: integer("createdAt", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  lastAccessedAt: integer("lastAccessedAt", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

// ─── Application Tables ────────────────────────────────────────────────────

export const serviceInstance = sqliteTable("service_instance", {
  id: text("id").primaryKey(),
  workspaceId: text("workspaceId")
    .notNull()
    .references(() => workspace.id, { onDelete: "cascade" }),
  serviceId: text("serviceId").notNull().unique(),
  name: text("name").notNull(),
  apiKey: text("apiKey").notNull(),
  whitelistedPaths: text("whitelistedPaths"),
  lastSeen: integer("lastSeen", { mode: "timestamp" }),
  status: text("status").default("offline"),
  createdAt: integer("createdAt", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updatedAt", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const note = sqliteTable("note", {
  id: text("id").primaryKey(),
  workspaceId: text("workspaceId")
    .notNull()
    .references(() => workspace.id, { onDelete: "cascade" }),
  content: text("content").default(""),
  createdAt: integer("createdAt", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updatedAt", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const chatMessage = sqliteTable("chat_message", {
  id: text("id").primaryKey(),
  workspaceId: text("workspaceId")
    .notNull()
    .references(() => workspace.id, { onDelete: "cascade" }),
  displayName: text("displayName").notNull().default("Anonymous"),
  content: text("content").notNull(),
  createdAt: integer("createdAt", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const terminalSession = sqliteTable("terminal_session", {
  id: text("id").primaryKey(),
  workspaceId: text("workspaceId")
    .notNull()
    .references(() => workspace.id, { onDelete: "cascade" }),
  serviceInstanceId: text("serviceInstanceId").references(
    () => serviceInstance.id,
    { onDelete: "set null" },
  ),
  tags: text("tags").default(""),
  status: text("status", { enum: ["active", "disconnected", "exited", "error"] })
    .notNull()
    .default("active"),
  exitCode: integer("exitCode"),
  createdAt: integer("createdAt", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updatedAt", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const screenshot = sqliteTable("screenshot", {
  id: text("id").primaryKey(),
  workspaceId: text("workspaceId")
    .notNull()
    .references(() => workspace.id, { onDelete: "cascade" }),
  serviceInstanceId: text("serviceInstanceId").references(
    () => serviceInstance.id,
    { onDelete: "set null" },
  ),
  imageData: text("imageData").notNull(),
  monitorIndex: integer("monitorIndex").notNull().default(0),
  width: integer("width").notNull().default(0),
  height: integer("height").notNull().default(0),
  capturedAt: integer("capturedAt", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  createdAt: integer("createdAt", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updatedAt", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const canvasNode = sqliteTable("canvas_node", {
  id: text("id").primaryKey(),
  workspaceId: text("workspaceId")
    .notNull()
    .references(() => workspace.id, { onDelete: "cascade" }),
  terminalSessionId: text("terminalSessionId").references(
    () => terminalSession.id,
    { onDelete: "set null" },
  ),
  nodeType: text("nodeType").notNull().default("terminal"),
  noteId: text("noteId").references(() => note.id, { onDelete: "set null" }),
  screenshotId: text("screenshotId").references(() => screenshot.id, {
    onDelete: "set null",
  }),
  serviceInstanceId: text("serviceInstanceId").references(
    () => serviceInstance.id,
    { onDelete: "set null" },
  ),
  x: real("x").notNull().default(100),
  y: real("y").notNull().default(100),
  width: real("width").notNull().default(600),
  height: real("height").notNull().default(400),
  zIndex: integer("zIndex").notNull().default(0),
  createdAt: integer("createdAt", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updatedAt", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const canvasEdge = sqliteTable("canvas_edge", {
  id: text("id").primaryKey(),
  workspaceId: text("workspaceId")
    .notNull()
    .references(() => workspace.id, { onDelete: "cascade" }),
  sourceNodeId: text("sourceNodeId")
    .notNull()
    .references(() => canvasNode.id, { onDelete: "cascade" }),
  targetNodeId: text("targetNodeId")
    .notNull()
    .references(() => canvasNode.id, { onDelete: "cascade" }),
  createdAt: integer("createdAt", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

// ─── Inferred Types ───────────────────────────────────────────────────────

export type SelectWorkspace = InferSelectModel<typeof workspace>;
export type InsertWorkspace = InferInsertModel<typeof workspace>;

export type SelectServiceInstance = InferSelectModel<typeof serviceInstance>;
export type InsertServiceInstance = InferInsertModel<typeof serviceInstance>;

export type SelectNote = InferSelectModel<typeof note>;
export type InsertNote = InferInsertModel<typeof note>;

export type SelectChatMessage = InferSelectModel<typeof chatMessage>;
export type InsertChatMessage = InferInsertModel<typeof chatMessage>;

export type SelectTerminalSession = InferSelectModel<typeof terminalSession>;
export type InsertTerminalSession = InferInsertModel<typeof terminalSession>;

export type SelectCanvasNode = InferSelectModel<typeof canvasNode>;
export type InsertCanvasNode = InferInsertModel<typeof canvasNode>;

export type SelectScreenshot = InferSelectModel<typeof screenshot>;
export type InsertScreenshot = InferInsertModel<typeof screenshot>;

export type SelectCanvasEdge = InferSelectModel<typeof canvasEdge>;
export type InsertCanvasEdge = InferInsertModel<typeof canvasEdge>;
