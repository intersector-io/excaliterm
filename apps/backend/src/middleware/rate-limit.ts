import type { MiddlewareHandler } from "hono";
import { HTTPException } from "hono/http-exception";

interface RateLimitOptions {
  /** Max requests per window */
  max: number;
  /** Window size in milliseconds */
  windowMs: number;
}

interface Entry {
  count: number;
  resetAt: number;
}

// Only consult X-Forwarded-For when an operator has explicitly placed a trusted reverse
// proxy in front of the backend. Otherwise clients can rotate the header to bypass limits.
const TRUST_PROXY = process.env.TRUST_PROXY === "true";

function getClientIp(c: Parameters<MiddlewareHandler>[0]): string {
  if (TRUST_PROXY) {
    // Take the last (nearest-proxy) entry — earlier entries are attacker-controlled.
    const xff = c.req.header("x-forwarded-for");
    const last = xff?.split(",").pop()?.trim();
    if (last) return last;
    const realIp = c.req.header("x-real-ip");
    if (realIp) return realIp;
  }

  // Fall back to the TCP peer address from the Node adapter.
  const incoming = (c.env as { incoming?: { socket?: { remoteAddress?: string } } })?.incoming;
  return incoming?.socket?.remoteAddress ?? "unknown";
}

/**
 * Simple fixed-window rate limiter keyed by client IP.
 * Stores counters in memory — suitable for single-instance deployments.
 */
export function rateLimiter(opts: RateLimitOptions): MiddlewareHandler {
  const store = new Map<string, Entry>();

  // Sweep expired entries every 60s to prevent memory leaks
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (now >= entry.resetAt) {
        store.delete(key);
      }
    }
  }, 60_000).unref();

  return async (c, next) => {
    const key = getClientIp(c);

    const now = Date.now();
    let entry = store.get(key);

    if (!entry || now >= entry.resetAt) {
      entry = { count: 0, resetAt: now + opts.windowMs };
      store.set(key, entry);
    }

    entry.count++;

    const remaining = Math.max(0, opts.max - entry.count);
    c.header("X-RateLimit-Limit", String(opts.max));
    c.header("X-RateLimit-Remaining", String(remaining));
    c.header("X-RateLimit-Reset", String(Math.ceil(entry.resetAt / 1000)));

    if (entry.count > opts.max) {
      c.header("Retry-After", String(Math.ceil((entry.resetAt - now) / 1000)));
      throw new HTTPException(429, { message: "Too many requests" });
    }

    await next();
  };
}
