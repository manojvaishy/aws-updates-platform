import { getDB } from "../../config/db";
import { UserRole } from "../../types";

export interface SearchOptions {
  q?: string;          // keyword / service name
  service?: string;    // specific service tag (e.g. "EC2")
  from?: string;       // ISO date
  to?: string;         // ISO date
  priority?: string;
  role?: UserRole;
  page?: number;
  limit?: number;
}

export interface SearchResult {
  id: string;
  title: string;
  simplified_en: string | null;
  source_url: string;
  published_at: Date;
  category: string;
  service_tags: string[];
  role_tags: UserRole[];
  priority: string;
  rank: number;        // ts_rank relevance score
}

export interface PaginatedSearchResults {
  data: SearchResult[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  query: string;
}

export async function searchUpdates(opts: SearchOptions): Promise<PaginatedSearchResults> {
  const page  = Math.max(1, opts.page ?? 1);
  const limit = Math.min(100, Math.max(1, opts.limit ?? 20));
  const offset = (page - 1) * limit;

  const db = getDB();
  const conditions: string[] = ["u.is_processed = TRUE"];
  const params: unknown[] = [];

  const p = () => `$${params.length}`;

  // Full-text search using tsvector
  let rankExpr = "0::float";
  if (opts.q) {
    params.push(opts.q);
    const qParam = p();
    conditions.push(`u.search_vector @@ plainto_tsquery('english', ${qParam})`);
    rankExpr = `ts_rank(u.search_vector, plainto_tsquery('english', ${qParam}))`;
  }

  // Service tag filter (case-insensitive)
  if (opts.service) {
    params.push(`%${opts.service.toUpperCase()}%`);
    conditions.push(`EXISTS (SELECT 1 FROM unnest(u.service_tags) t WHERE t ILIKE ${p()})`);
  }

  if (opts.role) {
    params.push(opts.role);
    conditions.push(`u.role_tags @> ARRAY[${p()}]::user_role[]`);
  }

  if (opts.priority) {
    params.push(opts.priority);
    conditions.push(`u.priority = ${p()}::priority_level`);
  }

  if (opts.from) {
    params.push(opts.from);
    conditions.push(`u.published_at >= ${p()}`);
  }

  if (opts.to) {
    params.push(opts.to);
    conditions.push(`u.published_at <= ${p()}`);
  }

  const where = conditions.join(" AND ");

  // Data query — ranked by relevance then recency
  params.push(limit);
  const limitParam = p();
  params.push(offset);
  const offsetParam = p();

  const [rowsResult, countResult] = await Promise.all([
    db.query<SearchResult>(
      `SELECT u.id, u.title, u.simplified_en, u.source_url,
              u.published_at, u.category, u.service_tags, u.role_tags,
              u.priority, ${rankExpr} AS rank
       FROM updates u
       WHERE ${where}
       ORDER BY rank DESC, u.published_at DESC
       LIMIT ${limitParam} OFFSET ${offsetParam}`,
      params
    ),
    db.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM updates u WHERE ${where}`,
      params.slice(0, params.length - 2)
    ),
  ]);

  const total = parseInt(countResult.rows[0].count, 10);

  return {
    data: rowsResult.rows,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    query: opts.q ?? "",
  };
}
