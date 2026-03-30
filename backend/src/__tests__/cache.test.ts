/**
 * Unit tests for cache invalidation logic — Task 15.2
 * Uses a mock Redis client — no real Redis connection needed.
 */

import { jest } from "@jest/globals";

// ── Mock Redis client ────────────────────────────────────────
const store = new Map<string, string>();

const mockRedis = {
  get: jest.fn(async (key: string) => store.get(key) ?? null),
  set: jest.fn(async (key: string, value: string, _ex: string, _ttl: number) => {
    store.set(key, value);
    return "OK";
  }),
  del: jest.fn(async (...keys: string[]) => {
    keys.forEach((k) => store.delete(k));
    return keys.length;
  }),
  scan: jest.fn(async (_cursor: string, _match: string, pattern: string, _count: string, _n: number) => {
    const matched = Array.from(store.keys()).filter((k) => {
      // Simple glob: replace * with .*
      const regex = new RegExp("^" + pattern.replace(/\*/g, ".*") + "$");
      return regex.test(k);
    });
    return ["0", matched];
  }),
};

// Mock the redis config module before importing cache
jest.mock("../config/redis", () => ({
  getRedis: () => mockRedis,
}));

// Now import cache functions (after mock is set up)
// eslint-disable-next-line @typescript-eslint/no-require-imports
const {
  cacheGet,
  cacheSet,
  cacheDel,
  cacheDelPattern,
  withCache,
  CacheKey,
  TTL,
  invalidateOnNewUpdate,
  invalidateUserReadState,
  invalidateUserAlerts,
} = require("../lib/cache") as typeof import("../lib/cache");

beforeEach(() => {
  store.clear();
  jest.clearAllMocks();
});

// ── CacheKey builders ────────────────────────────────────────

describe("CacheKey", () => {
  it("feed key includes role and page", () => {
    expect(CacheKey.feed("developer", 1)).toBe("feed:developer:1");
    expect(CacheKey.feed("devops", 3)).toBe("feed:devops:3");
  });

  it("dashboard key includes userId", () => {
    expect(CacheKey.dashboard("user-123")).toBe("dashboard:user-123");
  });

  it("unread key includes userId", () => {
    expect(CacheKey.unread("user-abc")).toBe("unread:user-abc");
  });

  it("alerts key includes userId", () => {
    expect(CacheKey.alerts("user-xyz")).toBe("alerts:user-xyz");
  });

  it("search key is an md5 hash (32 hex chars)", () => {
    const key = CacheKey.search("EC2 deprecation");
    expect(key).toMatch(/^search:[a-f0-9]{32}$/);
  });

  it("same search query produces same key", () => {
    expect(CacheKey.search("lambda")).toBe(CacheKey.search("lambda"));
  });

  it("different search queries produce different keys", () => {
    expect(CacheKey.search("lambda")).not.toBe(CacheKey.search("ec2"));
  });
});

// ── TTL values ───────────────────────────────────────────────

describe("TTL constants", () => {
  it("FEED is 5 minutes", () => expect(TTL.FEED).toBe(300));
  it("DASHBOARD is 2 minutes", () => expect(TTL.DASHBOARD).toBe(120));
  it("UNREAD is 1 minute", () => expect(TTL.UNREAD).toBe(60));
  it("SEARCH is 10 minutes", () => expect(TTL.SEARCH).toBe(600));
  it("ALERTS is 5 minutes", () => expect(TTL.ALERTS).toBe(300));
});

// ── cacheGet / cacheSet ──────────────────────────────────────

describe("cacheGet / cacheSet", () => {
  it("returns null on cache miss", async () => {
    const result = await cacheGet("missing-key");
    expect(result).toBeNull();
  });

  it("returns stored value on cache hit", async () => {
    await cacheSet("test-key", { foo: "bar" }, 60);
    const result = await cacheGet<{ foo: string }>("test-key");
    expect(result).toEqual({ foo: "bar" });
  });

  it("stores complex objects as JSON", async () => {
    const data = { updates: [{ id: "1", title: "Test" }], total: 1 };
    await cacheSet("complex-key", data, 300);
    const result = await cacheGet<typeof data>("complex-key");
    expect(result?.updates[0].title).toBe("Test");
  });

  it("returns null on Redis error (fail-open)", async () => {
    mockRedis.get.mockRejectedValueOnce(new Error("Redis down") as never);
    const result = await cacheGet("any-key");
    expect(result).toBeNull(); // fail-open, never throws
  });
});

// ── cacheDel ─────────────────────────────────────────────────

describe("cacheDel", () => {
  it("removes a single key", async () => {
    await cacheSet("del-key", "value", 60);
    await cacheDel("del-key");
    expect(await cacheGet("del-key")).toBeNull();
  });

  it("removes multiple keys at once", async () => {
    await cacheSet("key-a", "a", 60);
    await cacheSet("key-b", "b", 60);
    await cacheDel("key-a", "key-b");
    expect(await cacheGet("key-a")).toBeNull();
    expect(await cacheGet("key-b")).toBeNull();
  });

  it("does nothing when called with no keys", async () => {
    await expect(cacheDel()).resolves.not.toThrow();
  });
});

// ── cacheDelPattern ──────────────────────────────────────────

describe("cacheDelPattern", () => {
  it("deletes all keys matching a pattern", async () => {
    await cacheSet("feed:developer:1", "d1", 60);
    await cacheSet("feed:developer:2", "d2", 60);
    await cacheSet("feed:devops:1", "do1", 60);
    await cacheSet("unrelated:key", "x", 60);

    await cacheDelPattern("feed:*");

    expect(await cacheGet("feed:developer:1")).toBeNull();
    expect(await cacheGet("feed:developer:2")).toBeNull();
    expect(await cacheGet("feed:devops:1")).toBeNull();
    expect(await cacheGet("unrelated:key")).not.toBeNull(); // untouched
  });
});

// ── withCache ────────────────────────────────────────────────

describe("withCache", () => {
  it("calls loader on cache miss and caches result", async () => {
    const loader = jest.fn(async () => ({ data: "fresh" }));
    const result = await withCache("wc-key", 60, loader);
    expect(result).toEqual({ data: "fresh" });
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("returns cached value without calling loader on hit", async () => {
    await cacheSet("wc-hit", { data: "cached" }, 60);
    const loader = jest.fn(async () => ({ data: "fresh" }));
    const result = await withCache("wc-hit", 60, loader);
    expect(result).toEqual({ data: "cached" });
    expect(loader).not.toHaveBeenCalled();
  });
});

// ── Domain invalidation ──────────────────────────────────────

describe("invalidateOnNewUpdate", () => {
  it("busts all feed:* and search:* keys", async () => {
    await cacheSet("feed:developer:1", "d", 60);
    await cacheSet("feed:devops:2", "do", 60);
    await cacheSet("search:abc123", "s", 60);
    await cacheSet("unread:user-1", "u", 60); // should NOT be busted

    await invalidateOnNewUpdate();

    expect(await cacheGet("feed:developer:1")).toBeNull();
    expect(await cacheGet("feed:devops:2")).toBeNull();
    expect(await cacheGet("search:abc123")).toBeNull();
    expect(await cacheGet("unread:user-1")).not.toBeNull(); // untouched
  });
});

describe("invalidateUserReadState", () => {
  it("busts dashboard and unread keys for the user", async () => {
    const userId = "user-42";
    await cacheSet(`dashboard:${userId}`, "d", 60);
    await cacheSet(`unread:${userId}`, "u", 60);
    await cacheSet(`alerts:${userId}`, "a", 60); // should NOT be busted

    await invalidateUserReadState(userId);

    expect(await cacheGet(`dashboard:${userId}`)).toBeNull();
    expect(await cacheGet(`unread:${userId}`)).toBeNull();
    expect(await cacheGet(`alerts:${userId}`)).not.toBeNull(); // untouched
  });
});

describe("invalidateUserAlerts", () => {
  it("busts only the alerts key for the user", async () => {
    const userId = "user-99";
    await cacheSet(`alerts:${userId}`, "a", 60);
    await cacheSet(`unread:${userId}`, "u", 60); // should NOT be busted

    await invalidateUserAlerts(userId);

    expect(await cacheGet(`alerts:${userId}`)).toBeNull();
    expect(await cacheGet(`unread:${userId}`)).not.toBeNull(); // untouched
  });
});
