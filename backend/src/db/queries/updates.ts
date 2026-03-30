import { getDB } from "../../config/db";
import { Update, UserRole } from "../../types";

export interface GetUpdatesOptions {
  page?: number;
  limit?: number;
  role?: UserRole;
  category?: string;
  priority?: string;
  dateFrom?: string; // ISO date string
  dateTo?: string;   // ISO date string
}

export interface PaginatedUpdates {
  data: Update[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export async function getUpdates(opts: GetUpdatesOptions = {}): Promise<PaginatedUpdates> {
  const page = Math.max(1, opts.page ?? 1);
  const limit = Math.min(100, Math.max(1, opts.limit ?? 20));
  const offset = (page - 1) * limit;

  const db = getDB();
  const conditions: string[] = ["is_processed = TRUE"];
  const params: unknown[] = [];

  const p = () => `$${params.length}`;

  if (opts.role) {
    params.push(opts.role);
    conditions.push(`role_tags @> ARRAY[${p()}]::user_role[]`);
  }

  if (opts.category) {
    params.push(opts.category);
    conditions.push(`category = ${p()}`);
  }

  if (opts.priority) {
    params.push(opts.priority);
    conditions.push(`priority = ${p()}::priority_level`);
  }

  if (opts.dateFrom) {
    params.push(opts.dateFrom);
    conditions.push(`published_at >= ${p()}`);
  }

  if (opts.dateTo) {
    params.push(opts.dateTo);
    conditions.push(`published_at <= ${p()}`);
  }

  const where = conditions.join(" AND ");

  // Data query
  params.push(limit);
  const limitParam = p();
  params.push(offset);
  const offsetParam = p();

  const [rowsResult, countResult] = await Promise.all([
    db.query<Update>(
      `SELECT id, title, simplified_en, source_url,
              published_at, category, service_tags, role_tags,
              priority, processed_at
       FROM updates
       WHERE ${where}
       ORDER BY published_at DESC
       LIMIT ${limitParam} OFFSET ${offsetParam}`,
      params
    ),
    db.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM updates WHERE ${where}`,
      params.slice(0, params.length - 2) // exclude limit/offset
    ),
  ]);

  const total = parseInt(countResult.rows[0].count, 10);

  return {
    data: rowsResult.rows,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

export async function getUpdateById(id: string): Promise<Update | null> {
  const result = await getDB().query<Update>(
    `SELECT id, title, raw_content, simplified_en, simplified_hi,
            simplified_hinglish, source_url, published_at, category,
            service_tags, role_tags, priority, processed_at
     FROM updates WHERE id = $1`,
    [id]
  );
  return result.rows[0] ?? null;
}

/**
 * Fetch unread high/critical priority updates for a user's role.
 * Used for login-time notification popup.
 */
export async function getPriorityUpdatesForUser(
  userId: string,
  userRole: UserRole,
  limit = 10
): Promise<Update[]> {
  const result = await getDB().query<Update>(
    `SELECT u.id, u.title, u.simplified_en, u.source_url,
            u.published_at, u.category, u.service_tags, u.role_tags,
            u.priority, u.processed_at
     FROM updates u
     WHERE u.is_processed = TRUE
       AND u.priority IN ('critical', 'high')
       AND u.role_tags @> ARRAY[$1]::user_role[]
       AND NOT EXISTS (
         SELECT 1 FROM user_update_state s
         WHERE s.user_id = $2
           AND s.update_id = u.id
           AND (s.is_read = TRUE OR s.acknowledged_at IS NOT NULL)
       )
     ORDER BY
       CASE u.priority WHEN 'critical' THEN 0 ELSE 1 END,
       u.published_at DESC
     LIMIT $3`,
    [userRole, userId, limit]
  );
  return result.rows;
}
