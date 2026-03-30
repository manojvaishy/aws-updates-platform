import { getDB } from "../../config/db";

export interface PopularUpdate {
  id: string;
  title: string;
  category: string;
  priority: string;
  published_at: Date;
  view_count: number;
}

/**
 * Returns the top N most-viewed updates in the past 7 days.
 * Uses the partial index on analytics_events WHERE event_type = 'update_viewed'.
 */
export async function getPopularUpdates(limit = 5): Promise<PopularUpdate[]> {
  const result = await getDB().query<PopularUpdate>(
    `SELECT
       u.id,
       u.title,
       u.category,
       u.priority,
       u.published_at,
       COUNT(a.id)::int AS view_count
     FROM analytics_events a
     JOIN updates u ON u.id = a.update_id
     WHERE a.event_type = 'update_viewed'
       AND a.created_at >= NOW() - INTERVAL '7 days'
     GROUP BY u.id, u.title, u.category, u.priority, u.published_at
     ORDER BY view_count DESC
     LIMIT $1`,
    [limit]
  );
  return result.rows;
}

/**
 * Insert a single analytics event (fire-and-forget from the API).
 */
export async function insertEvent(
  userId: string | null,
  eventType: string,
  updateId: string | null,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  await getDB().query(
    `INSERT INTO analytics_events (user_id, event_type, update_id, metadata)
     VALUES ($1, $2, $3, $4)`,
    [userId, eventType, updateId, JSON.stringify(metadata)]
  );
}
