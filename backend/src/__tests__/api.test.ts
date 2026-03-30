/**
 * API integration tests — Task 15.3
 * Tests feed, search, and user state endpoints using supertest.
 * Mocks DB and Redis so no real connections are needed.
 */

import { jest } from "@jest/globals";
import request from "supertest";

// ── Mock DB ──────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockQuery = jest.fn<() => Promise<any>>();
jest.mock("../config/db", () => ({
  getDB: () => ({ query: mockQuery }),
}));

// ── Mock Redis ───────────────────────────────────────────────
const cacheStore = new Map<string, string>();
jest.mock("../config/redis", () => ({
  getRedis: () => ({
    get: jest.fn(async (k: string) => cacheStore.get(k) ?? null),
    set: jest.fn(async (k: string, v: string) => { cacheStore.set(k, v); return "OK"; }),
    del: jest.fn(async (...keys: string[]) => { keys.forEach((k) => cacheStore.delete(k)); return keys.length; }),
    scan: jest.fn(async () => ["0", []]),
    ping: jest.fn(async () => "PONG"),
  }),
  pingRedis: jest.fn(async () => true),
}));

// ── Mock JWT auth ────────────────────────────────────────────
jest.mock("jsonwebtoken", () => ({
  verify: jest.fn(() => ({ userId: "user-test-id", email: "test@example.com", role: "developer" })),
  sign: jest.fn(() => "mock-token"),
}));

// Import app after mocks
// eslint-disable-next-line @typescript-eslint/no-require-imports
const app = (require("../app") as { default: import("express").Express }).default;

const AUTH_HEADER = { Authorization: "Bearer mock-token" };

beforeEach(() => {
  cacheStore.clear();
  mockQuery.mockReset();
});

// ── GET /health ──────────────────────────────────────────────

describe("GET /health", () => {
  it("returns 200 with status ok", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ "?column?": 1 }] }); // DB ping
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.services).toHaveProperty("postgres");
    expect(res.body.services).toHaveProperty("redis");
  });
});

// ── GET /api/updates ─────────────────────────────────────────

describe("GET /api/updates", () => {
  const mockUpdates = [
    {
      id: "uuid-1",
      title: "EC2 update",
      simplified_en: "EC2 got faster",
      source_url: "https://aws.amazon.com/1",
      published_at: new Date("2025-01-15"),
      category: "Compute",
      service_tags: ["EC2"],
      role_tags: ["developer"],
      priority: "normal",
      processed_at: new Date(),
    },
  ];

  it("returns paginated updates", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: mockUpdates })       // data query
      .mockResolvedValueOnce({ rows: [{ count: "1" }] }); // count query

    const res = await request(app).get("/api/updates");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("data");
    expect(res.body).toHaveProperty("total");
    expect(res.body).toHaveProperty("page");
    expect(res.body).toHaveProperty("totalPages");
  });

  it("accepts role filter", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: mockUpdates })
      .mockResolvedValueOnce({ rows: [{ count: "1" }] });

    const res = await request(app).get("/api/updates?role=developer");
    expect(res.status).toBe(200);
  });

  it("accepts category filter", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ count: "0" }] });

    const res = await request(app).get("/api/updates?category=Compute");
    expect(res.status).toBe(200);
  });

  it("accepts date range filters", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ count: "0" }] });

    const res = await request(app).get("/api/updates?from=2025-01-01&to=2025-03-31");
    expect(res.status).toBe(200);
  });

  it("ignores invalid role values", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: mockUpdates })
      .mockResolvedValueOnce({ rows: [{ count: "1" }] });

    const res = await request(app).get("/api/updates?role=invalid_role");
    expect(res.status).toBe(200); // doesn't crash, just ignores
  });
});

// ── GET /api/updates/:id ─────────────────────────────────────

describe("GET /api/updates/:id", () => {
  it("returns 200 with update detail", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: "uuid-1", title: "Test", raw_content: "raw",
        simplified_en: "simple", simplified_hi: null, simplified_hinglish: null,
        source_url: "https://aws.amazon.com/1", published_at: new Date(),
        category: "Compute", service_tags: [], role_tags: [], priority: "normal",
      }],
    });

    const res = await request(app).get("/api/updates/uuid-1");
    expect(res.status).toBe(200);
    expect(res.body.title).toBe("Test");
  });

  it("returns 404 for unknown ID", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).get("/api/updates/nonexistent-id");
    expect(res.status).toBe(404);
  });
});

// ── GET /api/updates/priority ─────────────────────────────────

describe("GET /api/updates/priority", () => {
  it("returns 401 without auth token", async () => {
    const res = await request(app).get("/api/updates/priority");
    expect(res.status).toBe(401);
  });

  it("returns priority alerts for authenticated user", async () => {
    // findUserById
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: "user-test-id", role: "developer", email: "test@example.com" }],
    });
    // getPriorityUpdatesForUser
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .get("/api/updates/priority")
      .set(AUTH_HEADER);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("data");
    expect(res.body).toHaveProperty("count");
  });
});

// ── POST /api/updates/:id/read ────────────────────────────────

describe("POST /api/updates/:id/read", () => {
  it("returns 401 without auth", async () => {
    const res = await request(app).post("/api/updates/uuid-1/read");
    expect(res.status).toBe(401);
  });

  it("marks update as read and returns success", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] }); // markRead
    const res = await request(app)
      .post("/api/updates/uuid-1/read")
      .set(AUTH_HEADER);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// ── POST /api/updates/:id/unread ──────────────────────────────

describe("POST /api/updates/:id/unread", () => {
  it("marks update as unread and returns success", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] }); // markUnread
    const res = await request(app)
      .post("/api/updates/uuid-1/unread")
      .set(AUTH_HEADER);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// ── GET /api/search ───────────────────────────────────────────

describe("GET /api/search", () => {
  it("returns 400 when no search params provided", async () => {
    const res = await request(app).get("/api/search");
    expect(res.status).toBe(400);
  });

  it("returns results for keyword search", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ count: "0" }] });

    const res = await request(app).get("/api/search?q=EC2");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("data");
    expect(res.body).toHaveProperty("query");
  });

  it("returns results for service filter", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ count: "0" }] });

    const res = await request(app).get("/api/search?service=Lambda");
    expect(res.status).toBe(200);
  });
});

// ── GET /api/user/state ───────────────────────────────────────

describe("GET /api/user/state", () => {
  it("returns 401 without auth", async () => {
    const res = await request(app).get("/api/user/state");
    expect(res.status).toBe(401);
  });

  it("returns last-seen and unread count for authenticated user", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })                    // lastSeen
      .mockResolvedValueOnce({ rows: [{ count: "5" }] });     // unreadCount

    const res = await request(app)
      .get("/api/user/state")
      .set(AUTH_HEADER);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("lastSeenUpdateId");
    expect(res.body).toHaveProperty("unreadCount");
  });
});

// ── POST /api/user/state/last-seen ────────────────────────────

describe("POST /api/user/state/last-seen", () => {
  it("returns 400 for invalid UUID", async () => {
    const res = await request(app)
      .post("/api/user/state/last-seen")
      .set(AUTH_HEADER)
      .send({ updateId: "not-a-uuid" });
    expect(res.status).toBe(400);
  });

  it("saves last-seen position", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const res = await request(app)
      .post("/api/user/state/last-seen")
      .set(AUTH_HEADER)
      .send({ updateId: "550e8400-e29b-41d4-a716-446655440000" });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
