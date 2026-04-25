import { eq } from "drizzle-orm";
import { getDb, schema } from "../db/index.js";
import { parseTriggerConfig } from "../lib/mappers.js";
import { executeTriggerWithPrompt } from "./trigger-fire.js";
import type { TimerTriggerConfig } from "@excaliterm/shared-types";

interface ScheduledTrigger {
  id: string;
  nextFireAt: number;
}

let timer: NodeJS.Timeout | null = null;
let queue: ScheduledTrigger[] = [];

const FAILURE_BACKOFF_MS = 60_000;

function sortQueue() {
  queue.sort((a, b) => a.nextFireAt - b.nextFireAt);
}

function nextFireFromNow(intervalMin: number, lastFiredAt: Date | null): number {
  const intervalMs = intervalMin * 60_000;
  if (lastFiredAt) {
    const next = lastFiredAt.getTime() + intervalMs;
    return Math.max(next, Date.now() + 1_000);
  }
  return Date.now() + intervalMs;
}

function arm() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  const head = queue[0];
  if (!head) return;
  const delay = Math.max(0, head.nextFireAt - Date.now());
  timer = setTimeout(() => {
    void tick().catch((err) => console.error("[trigger-scheduler] tick error:", err));
  }, delay);
}

async function tick() {
  const head = queue.shift();
  if (!head) {
    arm();
    return;
  }
  await fireScheduledTrigger(head.id, { force: false });
  arm();
}

async function fireScheduledTrigger(triggerId: string, opts: { force: boolean }) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(schema.trigger)
    .where(eq(schema.trigger.id, triggerId));

  if (!row || row.type !== "timer") return;
  if (!opts.force && !row.enabled) return;

  const config = parseTriggerConfig("timer", row.config) as TimerTriggerConfig;
  const result = await executeTriggerWithPrompt(triggerId, config.prompt);

  if (row.enabled) {
    const nextFireAt = result.ok
      ? nextFireFromNow(config.intervalMin, result.firedAt)
      : Date.now() + Math.min(config.intervalMin * 60_000, FAILURE_BACKOFF_MS);
    queue.push({ id: triggerId, nextFireAt });
    sortQueue();
  }
}

export async function loadAllTriggers() {
  const db = getDb();
  const rows = await db.select().from(schema.trigger);
  queue = rows
    .filter((r) => r.enabled && r.type === "timer")
    .map((r) => {
      const config = parseTriggerConfig("timer", r.config) as TimerTriggerConfig;
      return { id: r.id, nextFireAt: nextFireFromNow(config.intervalMin, r.lastFiredAt) };
    });
  sortQueue();
  arm();
  console.log(`[trigger-scheduler] Loaded ${queue.length} enabled timer trigger(s)`);
}

export function rescheduleTimerTrigger(
  triggerId: string,
  enabled: boolean,
  intervalMin: number,
  lastFiredAt: Date | null,
) {
  queue = queue.filter((q) => q.id !== triggerId);
  if (enabled) {
    queue.push({ id: triggerId, nextFireAt: nextFireFromNow(intervalMin, lastFiredAt) });
    sortQueue();
  }
  arm();
}

export function unscheduleTrigger(triggerId: string) {
  queue = queue.filter((q) => q.id !== triggerId);
  arm();
}

export async function fireTimerTriggerNow(triggerId: string) {
  queue = queue.filter((q) => q.id !== triggerId);
  await fireScheduledTrigger(triggerId, { force: true });
  arm();
}
