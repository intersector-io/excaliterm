import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import { loadEnv } from "./env.js";
import { initializeDb, getDb, schema } from "./db/index.js";
import { eq, and, count } from "drizzle-orm";
import { initializeRedis, subscribe, publish } from "./lib/redis.js";
import { HTTPException } from "hono/http-exception";
import { timingSafeEqualStr } from "./lib/timing-safe.js";
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
import { commandHistory } from "./routes/command-history.js";
import { triggers } from "./routes/triggers.js";
import { triggersPublic } from "./routes/triggers-public.js";
import { loadAllTriggers } from "./services/trigger-scheduler.js";
import { initTerminalActivityTracking } from "./services/terminal-activity.js";

// ─── Bootstrap ─────────────────────────────────────────────────────────────

const env = loadEnv();

initializeDb();
initializeRedis();

// One-time rotation of any legacy "auto-registered" placeholder keys left by older
// builds — those are not secrets and must be replaced with unique values.
async function rotateLegacyAutoRegisteredKeys() {
  const db = getDb();
  const [probe] = await db
    .select({ id: schema.serviceInstance.id })
    .from(schema.serviceInstance)
    .where(eq(schema.serviceInstance.apiKey, "auto-registered"))
    .limit(1);
  if (!probe) return;

  const stale = await db
    .select()
    .from(schema.serviceInstance)
    .where(eq(schema.serviceInstance.apiKey, "auto-registered"));

  for (const row of stale) {
    const fresh = crypto.randomUUID();
    await db
      .update(schema.serviceInstance)
      .set({ apiKey: fresh, updatedAt: new Date() })
      .where(eq(schema.serviceInstance.id, row.id));
    console.log(
      `[startup] Rotated legacy apiKey for service ${row.serviceId} (workspace=${row.workspaceId}).`,
    );
  }
}

await rotateLegacyAutoRegisteredKeys();

await loadAllTriggers().catch((err) =>
  console.error("[trigger-scheduler] Failed to load triggers:", err),
);

await initTerminalActivityTracking().catch((err) =>
  console.error("[terminal-activity] Failed to subscribe:", err),
);

async function handleServiceOnline(serviceInstanceId: string, workspaceId: string) {
  const db = getDb();
  let serviceDbId: string | null = null;

  const [existing] = await db
    .select()
    .from(schema.serviceInstance)
    .where(
      and(
        eq(schema.serviceInstance.serviceId, serviceInstanceId),
        eq(schema.serviceInstance.workspaceId, workspaceId),
      ),
    );

  if (existing) {
    serviceDbId = existing.id;
    await db
      .update(schema.serviceInstance)
      .set({ status: "online", lastSeen: new Date(), updatedAt: new Date() })
      .where(eq(schema.serviceInstance.id, existing.id));
  } else if (workspaceId) {
    const [workspace] = await db
      .select()
      .from(schema.workspace)
      .where(eq(schema.workspace.id, workspaceId));

    if (workspace) {
      serviceDbId = crypto.randomUUID();
      const generatedApiKey = crypto.randomUUID();
      await db.insert(schema.serviceInstance).values({
        id: serviceDbId,
        workspaceId,
        serviceId: serviceInstanceId,
        name: serviceInstanceId,
        apiKey: generatedApiKey,
        status: "online",
        lastSeen: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      console.log(
        `[redis] Auto-registered service ${serviceInstanceId} (workspace=${workspaceId}). ` +
          `Generated apiKey stored in DB; retrieve it via the backend if needed.`,
      );
    } else {
      console.warn(`[redis] Ignoring service online event: workspace ${workspaceId} not found`);
    }
  }

  if (serviceDbId && workspaceId) {
    await ensureHostCanvasNode(serviceDbId, workspaceId, serviceInstanceId);
  }

  // Defer ServiceOnline fan-out until DB is consistent — otherwise the
  // frontend refetches before the auto-registered row and host canvas
  // node exist and the new host never appears until a page reload.
  await publish("service:online-ready", {
    serviceInstanceId,
    workspaceId,
    timestamp: Date.now(),
  }).catch((err: Error) =>
    console.error("[redis] Failed to publish service:online-ready:", err.message),
  );

  console.log(`[redis] Service ${serviceInstanceId} is now online`);
}

async function ensureHostCanvasNode(serviceDbId: string, workspaceId: string, serviceInstanceId: string) {
  const db = getDb();
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

  if (existingHostNode) return;

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

  const hostNodeId = crypto.randomUUID();
  await db.insert(schema.canvasNode).values({
    id: hostNodeId,
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

  await publish("canvas:updates", {
    action: "nodeAdded",
    workspaceId,
    userId: "system",
    node: {
      id: hostNodeId,
      terminalSessionId: null,
      userId: "system",
      x,
      y,
      width: HOST_W,
      height: HOST_H,
      zIndex: 0,
    },
  }).catch((err: Error) =>
    console.error("[redis] Failed to publish canvas:updates nodeAdded:", err.message),
  );
  console.log(`[redis] Created host canvas node for service ${serviceInstanceId}`);
}

async function handleServiceOffline(serviceInstanceId: string, workspaceId: string) {
  const db = getDb();
  const [existing] = await db
    .select()
    .from(schema.serviceInstance)
    .where(
      and(
        eq(schema.serviceInstance.serviceId, serviceInstanceId),
        eq(schema.serviceInstance.workspaceId, workspaceId),
      ),
    );

  if (existing) {
    await db
      .update(schema.serviceInstance)
      .set({ status: "offline", updatedAt: new Date() })
      .where(eq(schema.serviceInstance.id, existing.id));

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

  console.log(`[redis] Service ${serviceInstanceId} is now offline`);
}

// Subscribe to service events from SignalR Hub
try {
  await subscribe("service:events", async (message) => {
    try {
      const event = JSON.parse(message) as {
        event: string;
        serviceInstanceId: string;
        workspaceId: string;
      };

      if (event.event === "online") {
        await handleServiceOnline(event.serviceInstanceId, event.workspaceId);
      } else if (event.event === "offline") {
        await handleServiceOffline(event.serviceInstanceId, event.workspaceId);
      }
    } catch (err) {
      console.error("[redis] Failed to handle service event:", err);
    }
  });
} catch (err) {
  console.error("[redis] Failed to subscribe to service:events:", err);
}

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

// Validate a workspace API key — internal-only, used by the SignalR hub over the
// Docker network. Protected by a shared secret so it cannot be abused as a public
// oracle to confirm workspace/apiKey pairs.
app.get("/api/validate-key", async (c) => {
  const provided = c.req.header("x-internal-secret");
  if (!provided || !timingSafeEqualStr(provided, env.INTERNAL_API_SECRET)) {
    // Deliberately mimic a missing route to avoid advertising the endpoint.
    return c.notFound();
  }

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

// ─── Public trigger endpoint (auth via per-trigger secret) ────────────────

app.route("/api/triggers", triggersPublic);

// ─── Workspace-scoped Routes ──────────────────────────────────────────────

app.use("/api/w/:workspaceId/*", workspaceMiddleware);

app.route("/api/w/:workspaceId/terminals", terminals);
app.route("/api/w/:workspaceId/canvas", canvas);
app.route("/api/w/:workspaceId/services", services);
app.route("/api/w/:workspaceId/notes", notes);
app.route("/api/w/:workspaceId/chat", chat);
app.route("/api/w/:workspaceId/files", files);
app.route("/api/w/:workspaceId/command-history", commandHistory);
app.route("/api/w/:workspaceId/triggers", triggers);

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
