/**
 * Cache utility — all Redis interactions go through here.
 * Implements the caching strategy from the design doc:
 *
 * | Key pattern                  | TTL     | Invalidated by                  |
 * |------------------------------|---------|---------------------------------|
 * | feed:{role}:{page}           | 5 min   | new update ingested             |
 * | dashboard:{userId}           | 2 min   | read state change               |
 * | unread:{userId}              | 1 min   | mark read/unread                |
 * | search:{queryHash}           | 10 min  | new update ingested             |
 * | alerts:{userId}              | 5 min   | alert acknowledged              |
 */

import { createHash } from "crypto";
import { getRedis } from "../config/redis";
import { UserRole } from "../types";

// TTLs in seconds
const TTL = {
  FEED: 5 * 60,
  DASHBOARD: 2 * 60,
  UNREAD: 1 * 60,
  SEARCH: 10 * 60,
  ALERTS: 5 * 60,
} as const;

// ── Key builders ────────────────────────────────────────────

export const CacheKey = {
  feed: (role: UserRole, page: number) => `feed:${role}:${page}`,
  dashboard: (userId: string) => `dashboard:${userId}`,
  unread: (userId: string) => `unread:${userId}`,
  search: (query: string) => `search:${createHash("md5").update(query).digest("hex")}`,
  alerts: (userId: string) => `alerts:${userId}`,
};

// ── Core get/set/del ─────────────────────────────────────────

/**
 * Get a cached value. Returns null on miss or Redis error (fail-open).
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const raw = await getRedis().get(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch (err) {
    console.warn(`[cache] GET failed for key "${key}":`, err);
    return null; // fail-open — never block the request
  }
}

/**
 * Set a cached value with TTL (seconds).
 */
export async function cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  try {
    await getRedis().set(key, JSON.stringify(value), "EX", ttlSeconds);
  } catch (err) {
    console.warn(`[cache] SET failed for key "${key}":`, err);
  }
}

/**
 * Delete one or more keys.
 */
export async function cacheDel(...keys: string[]): Promise<void> {
  if (!keys.length) return;
  try {
    await getRedis().del(...keys);
  } catch (err) {
    console.warn(`[cache] DEL failed for keys "${keys.join(", ")}":`, err);
  }
}

/**
 * Delete all keys matching a pattern (uses SCAN — safe for production).
 */
export async function cacheDelPattern(pattern: string): Promise<void> {
  const redis = getRedis();
  let cursor = "0";
  try {
    do {
      const [nextCursor, keys] = await redis.scan(cursor, "MATCH", pattern, "COUNT", 100);
      cursor = nextCursor;
      if (keys.length) await redis.del(...keys);
    } while (cursor !== "0");
  } catch (err) {
    console.warn(`[cache] DEL pattern "${pattern}" failed:`, err);
  }
}

// ── Higher-level helpers ─────────────────────────────────────

/**
 * Cache-aside wrapper: returns cached value or calls loader, caches result.
 */
export async function withCache<T>(
  key: string,
  ttlSeconds: number,
  loader: () => Promise<T>
): Promise<T> {
  const cached = await cacheGet<T>(key);
  if (cached !== null) return cached;

  const fresh = await loader();
  await cacheSet(key, fresh, ttlSeconds);
  return fresh;
}

// ── Domain-specific invalidation ────────────────────────────

/**
 * Called after a new update is ingested.
 * Busts all feed pages for all roles + all search caches.
 */
export async function invalidateOnNewUpdate(): Promise<void> {
  await Promise.all([
    cacheDelPattern("feed:*"),
    cacheDelPattern("search:*"),
  ]);
}

/**
 * Called when a user marks an update read/unread.
 */
export async function invalidateUserReadState(userId: string): Promise<void> {
  await cacheDel(
    CacheKey.dashboard(userId),
    CacheKey.unread(userId)
  );
}

/**
 * Called when a user acknowledges a high-priority alert.
 */
export async function invalidateUserAlerts(userId: string): Promise<void> {
  await cacheDel(CacheKey.alerts(userId));
}

// ── TTL exports for use in route handlers ───────────────────
export { TTL };
