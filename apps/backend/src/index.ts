import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import { loadEnv } from "./env.js";
import { initializeDb, getDb, schema } from "./db/index.js";
import { eq, and, count } from "drizzle-orm";
import { initializeRedis, subscribe } from "./lib/redis.js";
import { HTTPException } from "hono/http-exception";
import { workspaceMiddleware } from "./middleware/workspace.js";
import { rateLimiter } from "./middleware/rate-limit.js";
import { health } from "./routes/health.js";
import { workspaces } from "./routes/workspaces.js";
import { terminals } from "./routes/terminals.js";
import { canvas } from "./routes/canvas.js";
import { services } from "./routes/services.js";
import { notes } from "./routes/notes.js";
import { chat } from "./routes/chat.js";
import { files } from "./routes/files.js";

// ─── Bootstrap ─────────────────────────────────────────────────────────────

const env = loadEnv();

initializeDb();
initializeRedis();

// Subscribe to service events from SignalR Hub
subscribe("service:events", async (message) => {
  try {
    const event = JSON.parse(message) as {
      event: string;
      serviceInstanceId: string;
      workspaceId: string;
    };
    const workspaceId = event.workspaceId;
    const db = getDb();

    if (event.event === "online") {
      let serviceDbId: string | null = null;

      const [existing] = await db
        .select()
        .from(schema.serviceInstance)
        .where(eq(schema.serviceInstance.serviceId, event.serviceInstanceId));

      if (existing) {
        serviceDbId = existing.id;
        await db
          .update(schema.serviceInstance)
          .set({ status: "online", lastSeen: new Date(), updatedAt: new Date() })
          .where(eq(schema.serviceInstance.serviceId, event.serviceInstanceId));
      } else if (workspaceId) {
        // Verify workspace exists before auto-registering
        const [workspace] = await db
          .select()
          .from(schema.workspace)
          .where(eq(schema.workspace.id, workspaceId));

        if (workspace) {
          serviceDbId = crypto.randomUUID();
          await db.insert(schema.serviceInstance).values({
            id: serviceDbId,
            workspaceId,
            serviceId: event.serviceInstanceId,
            name: event.serviceInstanceId,
            apiKey: "auto-registered",
            status: "online",
            lastSeen: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        } else {
          console.warn(`[redis] Ignoring service online event: workspace ${workspaceId} not found`);
        }
      }

      // Auto-create host canvas node if one doesn't exist yet
      if (serviceDbId && workspaceId) {
        const [existingHostNode] = await db
          .select()
          .from(schema.canvasNode)
          .where(
            and(
              eq(schema.canvasNode.workspaceId, workspaceId),
              eq(schema.canvasNode.nodeType, "host"),
              eq(schema.canvasNode.serviceInstanceId, serviceDbId),
            ),
          );

        if (!existingHostNode) {
          const [{ value: hostCount }] = await db
            .select({ value: count() })
            .from(schema.canvasNode)
            .where(
              and(
                eq(schema.canvasNode.workspaceId, workspaceId),
                eq(schema.canvasNode.nodeType, "host"),
              ),
            );

          const HOST_W = 280;
          const HOST_H = 160;
          const GAP = 60;
          const x = 72 + hostCount * (HOST_W + GAP);
          const y = 76;

          await db.insert(schema.canvasNode).values({
            id: crypto.randomUUID(),
            workspaceId,
            nodeType: "host",
            serviceInstanceId: serviceDbId,
            x,
            y,
            width: HOST_W,
            height: HOST_H,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
          console.log(`[redis] Created host canvas node for service ${event.serviceInstanceId}`);
        }
      }

      console.log(`[redis] Service ${event.serviceInstanceId} is now online`);
    } else if (event.event === "offline") {
      const [existing] = await db
        .select()
        .from(schema.serviceInstance)
        .where(eq(schema.serviceInstance.serviceId, event.serviceInstanceId));

      if (existing) {
        await db
          .update(schema.serviceInstance)
          .set({ status: "offline", updatedAt: new Date() })
          .where(eq(schema.serviceInstance.serviceId, event.serviceInstanceId));

        await db
          .update(schema.terminalSession)
          .set({ status: "disconnected", updatedAt: new Date() })
          .where(
            and(
              eq(schema.terminalSession.serviceInstanceId, existing.id),
              eq(schema.terminalSession.status, "active"),
            ),
          );
      }

      console.log(`[redis] Service ${event.serviceInstanceId} is now offline`);
    }
  } catch (err) {
    console.error("[redis] Failed to handle service event:", err);
  }
}).catch((err) => console.error("[redis] Failed to subscribe to service:events:", err));

// ─── Hono App ──────────────────────────────────────────────────────────────

const app = new Hono();

// CORS
app.use(
  "*",
  cors({
    origin: env.FRONTEND_URL,
    credentials: true,
    allowHeaders: ["Content-Type"],
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  }),
);

// Rate limiting – 100 requests per 60s per IP
app.use("*", rateLimiter({ max: 100, windowMs: 60_000 }));

// ─── Health (public) ───────────────────────────────────────────────────────

app.route("/api/health", health);

// ─── Connect Info (public) ────────────────────────────────────────────────

// Validate a workspace API key (used by SignalR hub)
app.get("/api/validate-key", async (c) => {
  const workspaceId = c.req.query("workspaceId");
  const apiKey = c.req.query("apiKey");

  if (!workspaceId || !apiKey) {
    return c.json({ valid: false }, 400);
  }

  const db = getDb();
  const [ws] = await db
    .select({ apiKey: schema.workspace.apiKey })
    .from(schema.workspace)
    .where(eq(schema.workspace.id, workspaceId));

  return c.json({ valid: !!ws && ws.apiKey === apiKey });
});

// ─── Workspaces (public) ──────────────────────────────────────────────────

app.route("/api/workspaces", workspaces);

// ─── Workspace-scoped Routes ──────────────────────────────────────────────

app.use("/api/w/:workspaceId/*", workspaceMiddleware);

app.route("/api/w/:workspaceId/terminals", terminals);
app.route("/api/w/:workspaceId/canvas", canvas);
app.route("/api/w/:workspaceId/services", services);
app.route("/api/w/:workspaceId/notes", notes);
app.route("/api/w/:workspaceId/chat", chat);
app.route("/api/w/:workspaceId/files", files);

// ─── Global Error Handler ──────────────────────────────────────────────────

app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return err.getResponse();
  }
  console.error("[server] Unhandled error:", err);
  return c.json({ error: "Internal Server Error" }, 500);
});

// ─── Start Server ──────────────────────────────────────────────────────────

const server = serve(
  {
    fetch: app.fetch,
    port: env.BACKEND_PORT,
  },
  (info) => {
    console.log(`[server] Backend listening on http://localhost:${info.port}`);
  },
);
