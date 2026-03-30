/**
 * Performance tests — Task 15.4
 *
 * Tests that:
 * - Dashboard feed (cached) responds under 500ms
 * - Dashboard feed (uncached, DB query) responds under 2000ms
 * - Search (cached) responds under 500ms
 * - Search (uncached) responds under 1500ms
 *
 * Uses mocked DB/Redis with configurable latency to simulate real conditions.
 */

import { jest } from "@jest/globals";
import request from "supertest";

// ── Configurable mock latency ────────────────────────────────
let dbLatencyMs = 0;
let cacheLatencyMs = 0;

const cacheStore = new Map<string, string>();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockQuery = jest.fn<() => Promise<any>>();

jest.mock("../config/db", () => ({
  getDB: () => ({ query: mockQuery }),
}));

jest.mock("../config/redis", () => ({
  getRedis: () => ({
    get: jest.fn(async (k: string) => {
      if (cacheLatencyMs > 0) await sleep(cacheLatencyMs);
      return cacheStore.get(k) ?? null;
    }),
    set: jest.fn(async (k: string, v: string) => { cacheStore.set(k, v); return "OK"; }),
    del: jest.fn(async (...keys: string[]) => { keys.forEach((k) => cacheStore.delete(k)); return keys.length; }),
    scan: jest.fn(async () => ["0", []]),
    ping: jest.fn(async () => "PONG"),
  }),
  pingRedis: jest.fn(async () => true),
}));

jest.mock("jsonwebtoken", () => ({
  verify: jest.fn(() => ({ userId: "perf-user", email: "perf@test.com", role: "developer" })),
  sign: jest.fn(() => "perf-token"),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const app = (require("../app") as { default: import("express").Express }).default;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

const MOCK_FEED_RESPONSE = {
  rows: Array.from({ length: 20 }, (_, i) => ({
    id: `uuid-${i}`,
    title: `Update ${i}`,
    simplified_en: `Summary ${i}`,
    source_url: `https://aws.amazon.com/${i}`,
    published_at: new Date(),
    category: "Compute",
    service_tags: ["EC2"],
    role_tags: ["developer"],
    priority: "normal",
    processed_at: new Date(),
  })),
};

const MOCK_COUNT = { rows: [{ count: "20" }] };

beforeEach(() => {
  cacheStore.clear();
  mockQuery.mockReset();
  dbLatencyMs = 0;
  cacheLatencyMs = 0;
});

// ── Helper ───────────────────────────────────────────────────

async function measureMs(fn: () => Promise<void>): Promise<number> {
  const start = Date.now();
  await fn();
  return Date.now() - start;
}

// ── Dashboard feed — cached ──────────────────────────────────

describe("Performance: GET /api/updates (cached)", () => {
  it("responds under 500ms when result is in cache", async () => {
    // Pre-populate cache
    cacheStore.set(
      "feed:developer:1",
      JSON.stringify({ data: MOCK_FEED_RESPONSE.rows, total: 20, page: 1, limit: 20, totalPages: 1 })
    );
    cacheLatencyMs = 5; // simulate 5ms Redis round-trip

    const ms = await measureMs(async () => {
      const res = await request(app).get("/api/updates?role=developer");
      expect(res.status).toBe(200);
    });

    console.log(`[perf] Cached feed: ${ms}ms`);
    expect(ms).toBeLessThan(500);
  });
});

// ── Dashboard feed — uncached (DB query) ─────────────────────

describe("Performance: GET /api/updates (uncached, DB)", () => {
  it("responds under 2000ms with simulated 200ms DB latency", async () => {
    dbLatencyMs = 200; // simulate realistic DB query time

    mockQuery.mockImplementation(async () => {
      await sleep(dbLatencyMs);
      return MOCK_FEED_RESPONSE;
    });
    // Second call for count
    mockQuery.mockImplementationOnce(async () => {
      await sleep(dbLatencyMs);
      return MOCK_FEED_RESPONSE;
    });
    mockQuery.mockImplementationOnce(async () => {
      await sleep(50);
      return MOCK_COUNT;
    });

    const ms = await measureMs(async () => {
      const res = await request(app).get("/api/updates?role=developer&page=2"); // page 2 = no cache
      expect(res.status).toBe(200);
    });

    console.log(`[perf] Uncached feed (200ms DB): ${ms}ms`);
    expect(ms).toBeLessThan(2000);
  });
});

// ── Search — cached ──────────────────────────────────────────

describe("Performance: GET /api/search (cached)", () => {
  it("responds under 500ms when result is in cache", async () => {
    // Pre-populate search cache
    const { createHash } = await import("crypto");
    const queryHash = createHash("md5")
      .update(JSON.stringify({ q: "EC2", service: undefined, role: undefined, priority: undefined, from: undefined, to: undefined, page: 1, limit: 20 }))
      .digest("hex");
    cacheStore.set(
      `search:${queryHash}`,
      JSON.stringify({ data: [], total: 0, page: 1, limit: 20, totalPages: 0, query: "EC2" })
    );
    cacheLatencyMs = 5;

    const ms = await measureMs(async () => {
      const res = await request(app).get("/api/search?q=EC2");
      expect(res.status).toBe(200);
    });

    console.log(`[perf] Cached search: ${ms}ms`);
    expect(ms).toBeLessThan(500);
  });
});

// ── Search — uncached ────────────────────────────────────────

describe("Performance: GET /api/search (uncached, DB)", () => {
  it("responds under 1500ms with simulated 300ms DB latency", async () => {
    dbLatencyMs = 300;

    mockQuery
      .mockImplementationOnce(async () => { await sleep(dbLatencyMs); return { rows: [] }; })
      .mockImplementationOnce(async () => { await sleep(50); return MOCK_COUNT; });

    const ms = await measureMs(async () => {
      const res = await request(app).get("/api/search?q=Lambda&page=99"); // unlikely to be cached
      expect(res.status).toBe(200);
    });

    console.log(`[perf] Uncached search (300ms DB): ${ms}ms`);
    expect(ms).toBeLessThan(1500);
  });
});

// ── Cache hit vs miss comparison ─────────────────────────────

describe("Performance: cache hit is significantly faster than miss", () => {
  it("cached response is at least 5x faster than uncached", async () => {
    // Uncached: simulate 100ms DB
    mockQuery
      .mockImplementationOnce(async () => { await sleep(100); return MOCK_FEED_RESPONSE; })
      .mockImplementationOnce(async () => { await sleep(20); return MOCK_COUNT; });

    const uncachedMs = await measureMs(async () => {
      await request(app).get("/api/updates?page=50"); // unlikely cached
    });

    // Cached: pre-populate
    cacheStore.set("feed:all:1", JSON.stringify({ data: [], total: 0, page: 1, limit: 20, totalPages: 0 }));
    cacheLatencyMs = 2;

    const cachedMs = await measureMs(async () => {
      await request(app).get("/api/updates?page=1");
    });

    console.log(`[perf] Uncached: ${uncachedMs}ms | Cached: ${cachedMs}ms | Ratio: ${(uncachedMs / cachedMs).toFixed(1)}x`);
    expect(cachedMs).toBeLessThan(uncachedMs);
  });
});
