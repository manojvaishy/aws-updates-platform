import { getDB } from "../config/db";
import { invalidateOnNewUpdate } from "../lib/cache";

export async function markProcessedAndInvalidate(updateIds: string[]): Promise<void> {
  if (!updateIds.length) return;

  await getDB().query(
    `UPDATE updates SET is_processed = TRUE, processed_at = NOW() WHERE id = ANY($1)`,
    [updateIds]
  );
  console.log(`[postProcess] Marked ${updateIds.length} updates as processed`);

  await invalidateOnNewUpdate();
  console.log("[postProcess] Redis caches invalidated (feed:*, search:*)");
}
