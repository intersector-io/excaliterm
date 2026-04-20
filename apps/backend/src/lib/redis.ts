import Redis from "ioredis";
import { getEnv } from "../env.js";

let _publisher: Redis | null = null;
let _subscriber: Redis | null = null;

export function initializeRedis() {
  const env = getEnv();

  _publisher = new Redis(env.REDIS_URL, { maxRetriesPerRequest: 3 });
  _subscriber = new Redis(env.REDIS_URL, { maxRetriesPerRequest: 3 });

  _publisher.on("error", (err) => console.error("[redis:pub] Error:", err.message));
  _subscriber.on("error", (err) => console.error("[redis:sub] Error:", err.message));
  _publisher.on("connect", () => console.log("[redis:pub] Connected"));
  _subscriber.on("connect", () => console.log("[redis:sub] Connected"));

  return { publisher: _publisher, subscriber: _subscriber };
}

export function getPublisher(): Redis {
  if (!_publisher) {
    throw new Error("Redis not initialized. Call initializeRedis() first.");
  }
  return _publisher;
}

export function getSubscriber(): Redis {
  if (!_subscriber) {
    throw new Error("Redis not initialized. Call initializeRedis() first.");
  }
  return _subscriber;
}

export async function publish(channel: string, data: unknown): Promise<void> {
  const pub = getPublisher();
  await pub.publish(channel, JSON.stringify(data));
}

export async function subscribe(
  channel: string,
  handler: (message: string) => void,
): Promise<void> {
  const sub = getSubscriber();
  await sub.subscribe(channel);
  sub.on("message", (ch, message) => {
    if (ch === channel) handler(message);
  });
}
