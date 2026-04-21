import Redis from "ioredis";
import { getEnv } from "../env.js";

let _publisher: Redis | null = null;
let _subscriber: Redis | null = null;

function createRedisClient(url: string, label: "pub" | "sub"): Redis {
  const client = new Redis(url, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    lazyConnect: false,
    retryStrategy: (times) => Math.min(times * 200, 2_000),
  });

  client.on("error", (err) => console.error(`[redis:${label}] Error:`, err.message));
  client.on("connect", () => console.log(`[redis:${label}] Connected`));

  return client;
}

export function initializeRedis() {
  const env = getEnv();

  _publisher = createRedisClient(env.REDIS_URL, "pub");
  _subscriber = createRedisClient(env.REDIS_URL, "sub");

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
