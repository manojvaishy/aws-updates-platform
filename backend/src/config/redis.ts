import Redis from "ioredis";

let client: Redis;

export function getRedis(): Redis {
  if (!client) throw new Error("Redis not connected. Call connectRedis() first.");
  return client;
}

export async function connectRedis(): Promise<void> {
  client = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
    lazyConnect: true,
    maxRetriesPerRequest: 3,
    // Reconnect with exponential backoff (max 30s)
    retryStrategy: (times) => Math.min(times * 200, 30_000),
    enableOfflineQueue: true, // queue commands while reconnecting
  });

  client.on("error", (err) => console.error("[redis] Error:", err.message));
  client.on("reconnecting", () => console.warn("[redis] Reconnecting..."));
  client.on("ready", () => console.log("[redis] Ready"));

  try {
    await client.connect();
    console.log("[redis] Connected");
  } catch (err) {
    console.error("[redis] Initial connection failed:", err);
    console.warn("[redis] Continuing without Redis cache...");
    // Don't throw - allow server to start without Redis
  }
}

export async function pingRedis(): Promise<boolean> {
  try {
    const result = await client.ping();
    return result === "PONG";
  } catch {
    return false;
  }
}

export async function disconnectRedis(): Promise<void> {
  await client?.quit();
}
