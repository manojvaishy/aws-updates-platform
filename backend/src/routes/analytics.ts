import { Router, Request, Response, NextFunction } from "express";
import { getPopularUpdates, insertEvent } from "../db/queries/analytics";
import { authenticate, AuthRequest } from "../middleware/auth";
import { z } from "zod";

const router = Router();

// ── GET /api/analytics/popular ────────────────────────────────
// Public — returns top 5 most-viewed updates this week.
router.get("/popular", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const popular = await getPopularUpdates(5);
    res.json({ data: popular });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/analytics/event ─────────────────────────────────
// Authenticated — records a user interaction event.
// Body: { eventType, updateId?, metadata? }
const eventSchema = z.object({
  eventType: z.enum([
    "update_viewed",
    "update_skipped",
    "update_marked_read",
    "search_performed",
    "language_switched",
    "notification_dismissed",
  ]),
  updateId: z.string().uuid().optional().nullable(),
  metadata: z.record(z.unknown()).optional(),
});

router.post(
  "/event",
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const parsed = eventSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Invalid event payload" });
        return;
      }
      const { eventType, updateId = null, metadata = {} } = parsed.data;
      // Non-blocking — don't await, respond immediately
      insertEvent(req.user!.userId, eventType, updateId, metadata).catch(
        (err) => console.error("[analytics] insert failed:", err)
      );
      res.status(202).json({ accepted: true });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
