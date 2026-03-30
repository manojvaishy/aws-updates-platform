import { Router, Response, NextFunction } from "express";
import { authenticate, AuthRequest } from "../middleware/auth";
import { getUserState, setLastSeen, acknowledgeAlerts } from "../db/queries/userState";
import { withCache, CacheKey, TTL, invalidateUserAlerts } from "../lib/cache";
import { z } from "zod";

const router = Router();

router.use(authenticate);

// ── GET /api/user/state ───────────────────────────────────────
// Cached: unread:{userId} TTL 1 min
router.get(
  "/state",
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.userId;
      const state = await withCache(
        CacheKey.unread(userId),
        TTL.UNREAD,
        () => getUserState(userId)
      );
      res.json(state);
    } catch (err) {
      next(err);
    }
  }
);

// ── POST /api/user/state/last-seen ────────────────────────────
const lastSeenSchema = z.object({ updateId: z.string().uuid() });

router.post(
  "/state/last-seen",
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const parsed = lastSeenSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "updateId (UUID) is required" });
        return;
      }
      await setLastSeen(req.user!.userId, parsed.data.updateId);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }
);

export default router;

// ── POST /api/user/alerts/acknowledge ────────────────────────
// Body: { updateIds: string[] }
// Persists acknowledged_at for each alert so they don't reappear.
const acknowledgeSchema = z.object({
  updateIds: z.array(z.string().uuid()).min(1),
});

router.post(
  "/alerts/acknowledge",
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const parsed = acknowledgeSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "updateIds (array of UUIDs) is required" });
        return;
      }
      await acknowledgeAlerts(req.user!.userId, parsed.data.updateIds);
      await invalidateUserAlerts(req.user!.userId);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }
);
