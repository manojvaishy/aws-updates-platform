/**
 * RSS feed failure handling and retry logic tests — Task 15.5
 * Tests pollFeed graceful failure, withRetry backoff, and computeHash.
 */

import { jest } from "@jest/globals";

// ── Mock rss-parser ──────────────────────────────────────────
const mockParseURL = jest.fn<() => Promise<unknown>>();
jest.mock("rss-parser", () => {
  return jest.fn().mockImplementation(() => ({ parseURL: mockParseURL }));
});

// ── Mock DB ──────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockQuery = jest.fn<() => Promise<any>>();
jest.mock("../config/db", () => ({
  getDB: () => ({ query: mockQuery }),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { pollFeed, computeHash } = require("../pipeline/rssPoller") as typeof import("../pipeline/rssPoller");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { withRetry } = require("../pipeline/retry") as typeof import("../pipeline/retry");

beforeEach(() => {
  mockParseURL.mockReset();
  mockQuery.mockReset();
});

// ── pollFeed — feed fetch failure ────────────────────────────

describe("pollFeed — RSS feed failure handling", () => {
  it("returns zero counts when feed URL is unreachable", async () => {
    mockParseURL.mockRejectedValueOnce(new Error("ECONNREFUSED") as never);

    const result = await pollFeed();

    expect(result.fetched).toBe(0);
    expect(result.inserted).toBe(0);
    expect(result.skipped).toBe(0);
    expect(result.errors).toBe(1);
    expect(result.insertedIds).toHaveLength(0);
  });

  it("returns zero counts on network timeout", async () => {
    mockParseURL.mockRejectedValueOnce(new Error("Request timeout") as never);

    const result = await pollFeed();
    expect(result.errors).toBe(1);
    expect(result.fetched).toBe(0);
  });

  it("returns zero counts on malformed XML response", async () => {
    mockParseURL.mockRejectedValueOnce(new Error("Non-whitespace before first tag") as never);

    const result = await pollFeed();
    expect(result.errors).toBe(1);
  });

  it("does not throw — always returns a PollResult", async () => {
    mockParseURL.mockRejectedValueOnce(new Error("Any error") as never);
    await expect(pollFeed()).resolves.not.toThrow();
  });
});

// ── pollFeed — partial failure (some items fail to insert) ───

describe("pollFeed — partial DB failure handling", () => {
  it("counts DB errors per item without crashing the whole poll", async () => {
    mockParseURL.mockResolvedValueOnce({
      items: [
        { title: "Item 1", link: "https://aws.amazon.com/1", pubDate: "2025-01-01", categories: [] },
        { title: "Item 2", link: "https://aws.amazon.com/2", pubDate: "2025-01-02", categories: [] },
      ],
    } as never);

    // loadKnownHashes — returns empty set (no duplicates)
    mockQuery.mockResolvedValueOnce({ rows: [] });
    // First insert succeeds
    mockQuery.mockResolvedValueOnce({ rows: [{ id: "uuid-1" }], rowCount: 1 });
    // Second insert fails
    mockQuery.mockRejectedValueOnce(new Error("DB constraint violation") as never);

    const result = await pollFeed();
    expect(result.fetched).toBe(2);
    expect(result.inserted).toBe(1);
    expect(result.errors).toBe(1);
    expect(result.insertedIds).toContain("uuid-1");
  });

  it("skips duplicate items detected by pre-check", async () => {
    mockParseURL.mockResolvedValueOnce({
      items: [
        { title: "Existing Item", link: "https://aws.amazon.com/existing", pubDate: "2025-01-01", categories: [] },
      ],
    } as never);

    // loadKnownHashes — returns the hash of this item (already exists)
    const { computeContentHash } = await import("../pipeline/deduplication");
    const existingHash = computeContentHash("https://aws.amazon.com/existing", "Existing Item", "2025-01-01");
    mockQuery.mockResolvedValueOnce({ rows: [{ content_hash: existingHash }] });

    const result = await pollFeed();
    expect(result.fetched).toBe(1);
    expect(result.skipped).toBe(1);
    expect(result.inserted).toBe(0);
    expect(result.errors).toBe(0);
  });

  it("handles empty feed gracefully", async () => {
    mockParseURL.mockResolvedValueOnce({ items: [] } as never);
    mockQuery.mockResolvedValueOnce({ rows: [] }); // loadKnownHashes

    const result = await pollFeed();
    expect(result.fetched).toBe(0);
    expect(result.inserted).toBe(0);
    expect(result.skipped).toBe(0);
    expect(result.errors).toBe(0);
  });
});

// ── computeHash ──────────────────────────────────────────────

describe("computeHash (rssPoller wrapper)", () => {
  it("returns a non-empty string", () => {
    const hash = computeHash("https://aws.amazon.com/test", "Title", "2025-01-01");
    expect(typeof hash).toBe("string");
    expect(hash.length).toBeGreaterThan(0);
  });
});

// ── withRetry — retry logic ──────────────────────────────────

describe("withRetry — retry logic", () => {
  it("succeeds on first attempt without retrying", async () => {
    const fn = jest.fn<() => Promise<string>>().mockResolvedValueOnce("success");
    const result = await withRetry(fn, { maxAttempts: 3, baseDelayMs: 1 });
    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries on failure and succeeds on second attempt", async () => {
    const fn = jest.fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error("transient") as never)
      .mockResolvedValueOnce("success");

    const result = await withRetry(fn, { maxAttempts: 3, baseDelayMs: 1 });
    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("retries up to maxAttempts then throws", async () => {
    const fn = jest.fn<() => Promise<string>>()
      .mockRejectedValue(new Error("persistent failure") as never);

    await expect(
      withRetry(fn, { maxAttempts: 3, baseDelayMs: 1 })
    ).rejects.toThrow("persistent failure");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("succeeds on third attempt after two failures", async () => {
    const fn = jest.fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error("fail 1") as never)
      .mockRejectedValueOnce(new Error("fail 2") as never)
      .mockResolvedValueOnce("third time lucky");

    const result = await withRetry(fn, { maxAttempts: 3, baseDelayMs: 1 });
    expect(result).toBe("third time lucky");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("respects maxAttempts: 1 (no retries)", async () => {
    const fn = jest.fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error("fail") as never);

    await expect(
      withRetry(fn, { maxAttempts: 1, baseDelayMs: 1 })
    ).rejects.toThrow("fail");
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
