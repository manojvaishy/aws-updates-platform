import { Router, Request, Response, NextFunction } from "express";
import { createHash } from "crypto";
import { getUpdates, getUpdateById, getPriorityUpdatesForUser } from "../db/queries/updates";
import { markRead, markUnread } from "../db/queries/userState";
import { findUserById } from "../db/queries/users";
import { authenticate, AuthRequest } from "../middleware/auth";
import { withCache, CacheKey, TTL, invalidateUserReadState, invalidateUserAlerts } from "../lib/cache";
import { UserRole } from "../types";

const VALID_ROLES: UserRole[] = [
  "solution_architect", "developer", "devops", "data_engineer",
];

const VALID_PRIORITIES = ["critical", "high", "normal"];

const router = Router();

// ── GET /api/updates ─────────────────────────────────────────
// Query params:
//   page      (default 1)
//   limit     (default 20, max 100)
//   role      solution_architect | developer | devops | data_engineer
//   category  string (e.g. "Compute", "Storage")
//   priority  critical | high | normal
//   from      ISO date (e.g. 2025-01-01)
//   to        ISO date (e.g. 2025-03-31)
//
// Cache key: hash of all filter params so each unique filter combo is cached
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page     = parseInt(req.query.page as string) || 1;
    const limit    = parseInt(req.query.limit as string) || 20;
    const roleParam = req.query.role as string | undefined;
    const category  = req.query.category as string | undefined;
    const priority  = req.query.priority as string | undefined;
    const dateFrom  = req.query.from as string | undefined;
    const dateTo    = req.query.to as string | undefined;

    const role = roleParam && VALID_ROLES.includes(roleParam as UserRole)
      ? (roleParam as UserRole)
      : undefined;

    const validPriority = priority && VALID_PRIORITIES.includes(priority)
      ? priority
      : undefined;

    // Build a stable cache key from all active filters
    const filterKey = createHash("md5")
      .update(JSON.stringify({ role, category, validPriority, dateFrom, dateTo, page, limit }))
      .digest("hex");

    const cacheKey = role && !category && !validPriority && !dateFrom && !dateTo
      ? CacheKey.feed(role, page)   // use clean key for simple role-only queries
      : `feed:filtered:${filterKey}`;

    const result = await withCache(cacheKey, TTL.FEED, () =>
      getUpdates({ page, limit, role, category, priority: validPriority, dateFrom, dateTo })
    );

    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ── GET /api/updates/priority ─────────────────────────────────
// Returns unread critical/high updates for the current user's role.
// Cached: alerts:{userId} TTL 5 min
// Requires auth.
router.get(
  "/priority",
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.userId;

      // Get user's role from DB (JWT role may be stale after profile update)
      const user = await findUserById(userId);
      if (!user) {
        res.status(401).json({ error: "User not found" });
        return;
      }

      const alerts = await withCache(
        CacheKey.alerts(userId),
        TTL.ALERTS,
        () => getPriorityUpdatesForUser(userId, user.role)
      );

      res.json({ data: alerts, count: alerts.length });
    } catch (err) {
      next(err);
    }
  }
);

// ── GET /api/updates/:id ──────────────────────────────────────
// Cached: update:{id} TTL 10 min (update detail rarely changes)
router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const update = await withCache(`update:${id}`, TTL.SEARCH, () => getUpdateById(id));
    if (!update) {
      res.status(404).json({ error: "Update not found" });
      return;
    }
    res.json(update);
  } catch (err) {
    next(err);
  }
});

// ── POST /api/updates/:id/read ────────────────────────────────
router.post(
  "/:id/read",
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      await markRead(req.user!.userId, req.params.id);
      await invalidateUserReadState(req.user!.userId);
      await invalidateUserAlerts(req.user!.userId);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }
);

// ── POST /api/updates/:id/unread ──────────────────────────────
router.post(
  "/:id/unread",
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      await markUnread(req.user!.userId, req.params.id);
      await invalidateUserReadState(req.user!.userId);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
