import { Router, Request, Response, NextFunction } from "express";
import { searchUpdates } from "../db/queries/search";
import { withCache, CacheKey, TTL } from "../lib/cache";
import { UserRole } from "../types";

const router = Router();

const VALID_ROLES: UserRole[] = [
  "solution_architect", "developer", "devops", "data_engineer",
];

// ── GET /api/search ───────────────────────────────────────────
// Query params:
//   q         keyword or service name (e.g. "EC2", "cost optimization")
//   service   specific service tag filter (e.g. "Lambda")
//   role      filter by role relevance
//   priority  critical | high | normal
//   from      ISO date
//   to        ISO date
//   page      (default 1)
//   limit     (default 20)
//
// Cached: search:{queryHash} TTL 10 min (task 6.5)
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q        = (req.query.q as string | undefined)?.trim();
    const service  = req.query.service as string | undefined;
    const priority = req.query.priority as string | undefined;
    const from     = req.query.from as string | undefined;
    const to       = req.query.to as string | undefined;
    const page     = parseInt(req.query.page as string) || 1;
    const limit    = parseInt(req.query.limit as string) || 20;
    const roleParam = req.query.role as string | undefined;

    const role = roleParam && VALID_ROLES.includes(roleParam as UserRole)
      ? (roleParam as UserRole)
      : undefined;

    // Require at least one search parameter
    if (!q && !service && !role && !priority && !from && !to) {
      res.status(400).json({ error: "At least one search parameter is required (q, service, role, priority, from, to)" });
      return;
    }

    // Build cache key from all search params (task 6.5)
    const cacheKey = CacheKey.search(
      JSON.stringify({ q, service, role, priority, from, to, page, limit })
    );

    const results = await withCache(cacheKey, TTL.SEARCH, () =>
      searchUpdates({ q, service, role, priority, from, to, page, limit })
    );

    res.json(results);
  } catch (err) {
    next(err);
  }
});

export default router;
