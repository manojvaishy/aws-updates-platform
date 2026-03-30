/**
 * RSS Feed Poller — Task 3.1
 *
 * Fetches the AWS What's New RSS feed and stores raw updates in the DB.
 * Duplicate detection (task 3.2) is handled via content_hash.
 * Downstream enrichment (simplification, tagging, translation) is triggered
 * after each new item is stored.
 */

import Parser from "rss-parser";
import { getDB } from "../config/db";
import { computeContentHash, loadKnownHashes } from "./deduplication";

const RSS_URL =
  process.env.AWS_RSS_FEED_URL ||
  "https://aws.amazon.com/about-aws/whats-new/recent/feed/";

interface RawFeedItem {
  title: string;
  content: string;
  link: string;
  pubDate: string;
  categories: string[];
}

const parser = new Parser({
  customFields: {
    item: [["content:encoded", "content"]],
  },
});

/**
 * Fetch and parse the AWS RSS feed.
 * Returns normalized items ready for DB insertion.
 */
export async function fetchFeed(): Promise<RawFeedItem[]> {
  const feed = await parser.parseURL(RSS_URL);

  return (feed.items ?? []).map((item) => ({
    title: (item.title ?? "").trim(),
    content: (item["content"] as string) || item.contentSnippet || item.summary || "",
    link: item.link ?? "",
    pubDate: item.pubDate ?? item.isoDate ?? new Date().toISOString(),
    categories: Array.isArray(item.categories) ? item.categories : [],
  }));
}

/**
 * Compute a stable hash for duplicate detection.
 * Delegates to the deduplication module (task 3.2).
 */
export function computeHash(link: string, title: string, pubDate: string): string {
  return computeContentHash(link, title, pubDate);
}

/**
 * Derive a category label from RSS item categories or title keywords.
 */
function deriveCategory(categories: string[], title: string): string {
  if (categories.length > 0) return categories[0];

  const lower = title.toLowerCase();
  if (lower.includes("lambda") || lower.includes("serverless")) return "Serverless";
  if (lower.includes("s3") || lower.includes("storage")) return "Storage";
  if (lower.includes("ec2") || lower.includes("instance")) return "Compute";
  if (lower.includes("rds") || lower.includes("database") || lower.includes("aurora")) return "Database";
  if (lower.includes("iam") || lower.includes("security") || lower.includes("kms")) return "Security";
  if (lower.includes("cloudformation") || lower.includes("cdk")) return "Infrastructure";
  if (lower.includes("eks") || lower.includes("ecs") || lower.includes("container")) return "Containers";
  if (lower.includes("glue") || lower.includes("athena") || lower.includes("redshift")) return "Analytics";
  if (lower.includes("bedrock") || lower.includes("sagemaker") || lower.includes("ai")) return "AI/ML";
  return "General";
}

/**
 * Insert a single raw feed item into the DB.
 * Returns the new update's ID if inserted, null if skipped (duplicate).
 */
async function insertRawUpdate(item: RawFeedItem): Promise<string | null> {
  const hash = computeContentHash(item.link, item.title, item.pubDate);
  const category = deriveCategory(item.categories, item.title);

  const result = await getDB().query<{ id: string }>(
    `INSERT INTO updates (
       title, raw_content, source_url, content_hash,
       published_at, category, is_processed
     )
     VALUES ($1, $2, $3, $4, $5, $6, FALSE)
     ON CONFLICT (content_hash) DO NOTHING
     RETURNING id`,
    [
      item.title,
      item.content,
      item.link,
      hash,
      new Date(item.pubDate),
      category,
    ]
  );

  return result.rows[0]?.id ?? null;
}

export interface PollResult {
  fetched: number;
  inserted: number;
  skipped: number;
  errors: number;
  insertedIds: string[]; // IDs of newly inserted updates — passed to enrichment pipeline
}

/**
 * Main poll function — fetch feed, insert new items, return stats.
 * Uses batch hash pre-check to skip known duplicates without DB inserts.
 */
export async function pollFeed(): Promise<PollResult> {
  console.log("[rss] Starting feed poll...");

  let items: RawFeedItem[];
  try {
    items = await fetchFeed();
  } catch (err) {
    console.error("[rss] Failed to fetch feed:", err);
    return { fetched: 0, inserted: 0, skipped: 0, errors: 1, insertedIds: [] };
  }

  console.log(`[rss] Fetched ${items.length} items`);

  // Batch pre-check: load all known hashes once to avoid N DB queries
  const knownHashes = await loadKnownHashes();
  console.log(`[rss] ${knownHashes.size} known hashes loaded`);

  // Filter out duplicates before touching the DB
  const newItems = items.filter((item) => {
    const hash = computeContentHash(item.link, item.title, item.pubDate);
    return !knownHashes.has(hash);
  });

  console.log(`[rss] ${newItems.length} new items to insert (${items.length - newItems.length} pre-filtered duplicates)`);

  let inserted = 0;
  let skipped = 0;
  let errors = 0;
  const insertedIds: string[] = [];

  for (const item of newItems) {
    try {
      const id = await insertRawUpdate(item);
      if (id) {
        inserted++;
        insertedIds.push(id);
        console.log(`[rss] New: "${item.title.slice(0, 60)}"`);
      } else {
        // Race condition — another process inserted between pre-check and insert
        skipped++;
      }
    } catch (err) {
      errors++;
      console.error(`[rss] Error inserting "${item.title.slice(0, 40)}":`, err);
    }
  }

  skipped += items.length - newItems.length; // add pre-filtered count

  console.log(`[rss] Done — inserted: ${inserted}, skipped: ${skipped}, errors: ${errors}`);
  return { fetched: items.length, inserted, skipped, errors, insertedIds };
}
