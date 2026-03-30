import { getDB } from "../../config/db";

/**
 * Mark an update as read for a user.
 */
export async function markRead(userId: string, updateId: string): Promise<void> {
  await getDB().query(
    `INSERT INTO user_update_state (user_id, update_id, is_read, read_at)
     VALUES ($1, $2, TRUE, NOW())
     ON CONFLICT (user_id, update_id)
     DO UPDATE SET is_read = TRUE, read_at = NOW()`,
    [userId, updateId]
  );
}

/**
 * Mark an update as unread for a user.
 */
export async function markUnread(userId: string, updateId: string): Promise<void> {
  await getDB().query(
    `INSERT INTO user_update_state (user_id, update_id, is_read)
     VALUES ($1, $2, FALSE)
     ON CONFLICT (user_id, update_id)
     DO UPDATE SET is_read = FALSE, read_at = NULL`,
    [userId, updateId]
  );
}

/**
 * Get read state for a set of update IDs for a given user.
 */
export async function getReadStates(
  userId: string,
  updateIds: string[]
): Promise<Set<string>> {
  if (!updateIds.length) return new Set();
  const result = await getDB().query<{ update_id: string }>(
    `SELECT update_id FROM user_update_state
     WHERE user_id = $1 AND update_id = ANY($2) AND is_read = TRUE`,
    [userId, updateIds]
  );
  return new Set(result.rows.map((r) => r.update_id));
}

/**
 * Set the last-seen update for a user (only one per user at a time).
 * The DB trigger enforces the single-row constraint.
 */
export async function setLastSeen(userId: string, updateId: string): Promise<void> {
  await getDB().query(
    `INSERT INTO user_update_state (user_id, update_id, is_last_seen)
     VALUES ($1, $2, TRUE)
     ON CONFLICT (user_id, update_id)
     DO UPDATE SET is_last_seen = TRUE`,
    [userId, updateId]
  );
}

/**
 * Get the last-seen update ID for a user, plus unread count.
 */
export async function getUserState(userId: string): Promise<{
  lastSeenUpdateId: string | null;
  unreadCount: number;
}> {
  const [lastSeenResult, unreadResult] = await Promise.all([
    getDB().query<{ update_id: string }>(
      `SELECT update_id FROM user_update_state
       WHERE user_id = $1 AND is_last_seen = TRUE
       LIMIT 1`,
      [userId]
    ),
    getDB().query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM updates u
       WHERE u.is_processed = TRUE
         AND NOT EXISTS (
           SELECT 1 FROM user_update_state s
           WHERE s.user_id = $1 AND s.update_id = u.id AND s.is_read = TRUE
         )`,
      [userId]
    ),
  ]);

  return {
    lastSeenUpdateId: lastSeenResult.rows[0]?.update_id ?? null,
    unreadCount: parseInt(unreadResult.rows[0]?.count ?? "0", 10),
  };
}

/**
 * Acknowledge a high-priority alert — sets acknowledged_at so it won't
 * reappear in the priority alerts popup.
 */
export async function acknowledgeAlert(userId: string, updateId: string): Promise<void> {
  await getDB().query(
    `INSERT INTO user_update_state (user_id, update_id, acknowledged_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (user_id, update_id)
     DO UPDATE SET acknowledged_at = NOW()`,
    [userId, updateId]
  );
}

/**
 * Acknowledge multiple alerts at once.
 */
export async function acknowledgeAlerts(userId: string, updateIds: string[]): Promise<void> {
  if (!updateIds.length) return;
  await Promise.all(updateIds.map((id) => acknowledgeAlert(userId, id)));
}
