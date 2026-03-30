/**
 * Duplicate Detection — Task 3.2
 *
 * Strategy:
 * 1. Hash = MD5(link + title + pubDate) — covers URL changes AND content updates
 * 2. Batch pre-check: load all known hashes from DB in one query before processing
 * 3. DB-level safety net: UNIQUE constraint on content_hash catches any races
 */

import crypto from "crypto";
import { getDB } from "../config/db";

/**
 * Compute a stable content hash from the three fields that uniquely
 * identify an AWS announcement.
 *
 * - link:    primary identifier (URL)
 * - title:   catches title corrections on the same URL
 * - pubDate: catches re-published items with the same URL
 */
export function computeContentHash(link: string, title: string, pubDate: string): string {
  const input = [
    link.trim().toLowerCase(),
    title.trim().toLowerCase(),
    // Normalize date to ISO date-only (ignore time jitter in re-fetches)
    new Date(pubDate).toISOString().slice(0, 10),
  ].join("|");

  return crypto.createHash("md5").update(input).digest("hex");
}

/**
 * Batch-fetch all content hashes already stored in the DB.
 * Returns a Set for O(1) lookup during the poll loop.
 *
 * Called once per poll run — avoids N individual SELECT queries.
 */
export async function loadKnownHashes(): Promise<Set<string>> {
  const result = await getDB().query<{ content_hash: string }>(
    "SELECT content_hash FROM updates"
  );
  return new Set(result.rows.map((r) => r.content_hash));
}

/**
 * Check whether a single hash is already in the DB.
 * Use loadKnownHashes() for batch operations; this is for one-off checks.
 */
export async function isDuplicate(hash: string): Promise<boolean> {
  const result = await getDB().query<{ exists: boolean }>(
    "SELECT EXISTS(SELECT 1 FROM updates WHERE content_hash = $1) AS exists",
    [hash]
  );
  return result.rows[0]?.exists ?? false;
}
