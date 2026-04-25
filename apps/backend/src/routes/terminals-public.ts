import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { eq } from "drizzle-orm";
import { getDb, schema } from "../db/index.js";
import { getPublisher } from "../lib/redis.js";
import { rateLimiter } from "../middleware/rate-limit.js";
import { timingSafeEqualStr } from "../lib/timing-safe.js";

const terminalsPublic = new Hono();

const DEFAULT_LINES = 200;
const MAX_LINES = 1000;

terminalsPublic.get(
  "/:id/output",
  rateLimiter({ max: 120, windowMs: 60_000 }),
  async (c) => {
    const terminalId = c.req.param("id");
    const db = getDb();

    const [row] = await db
      .select()
      .from(schema.terminalSession)
      .where(eq(schema.terminalSession.id, terminalId));

    if (!row) {
      throw new HTTPException(404, { message: "Terminal not found" });
    }

    const provided = c.req.header("x-terminal-read-token") ?? "";
    if (!provided || !row.readToken || !timingSafeEqualStr(provided, row.readToken)) {
      throw new HTTPException(401, { message: "Invalid token" });
    }

    const linesRaw = Number(c.req.query("lines"));
    const lines = Number.isFinite(linesRaw) && linesRaw > 0
      ? Math.min(MAX_LINES, Math.floor(linesRaw))
      : DEFAULT_LINES;

    // The hub buffers raw chunks in `terminal:buffer:<id>` (a Redis list).
    // Each entry is whatever the agent emitted — could be bytes, partial lines,
    // or multi-line blobs. We concatenate, split by newline, then tail.
    const pub = getPublisher();
    const entries = await pub.lrange(`terminal:buffer:${terminalId}`, 0, -1);
    const stream = entries.join("");
    // Strip trailing CR (Windows line endings) so split-by-\n gives clean lines.
    const allLines = stream.split("\n").map((l) => l.replace(/\r$/, ""));
    // If the stream ends without a trailing newline, the last "line" is partial
    // but still meaningful — keep it.
    const tail = allLines.slice(-lines);

    return c.json({
      terminalId,
      lines: tail,
      totalLines: tail.length,
      capturedAt: new Date().toISOString(),
    });
  },
);

export { terminalsPublic };
