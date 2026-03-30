"use client";

/**
 * Analytics event client — Task 13.x
 * All calls are fire-and-forget (non-blocking).
 * Fails silently — never impacts user experience.
 */

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

type EventType =
  | "update_viewed"
  | "update_skipped"
  | "update_marked_read"
  | "search_performed"
  | "language_switched"
  | "notification_dismissed";

interface EventPayload {
  eventType: EventType;
  updateId?: string;
  metadata?: Record<string, unknown>;
}

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

/**
 * Send an analytics event. Non-blocking — returns immediately.
 */
export function trackEvent(payload: EventPayload): void {
  const token = getToken();
  if (!token) return; // not authenticated, skip

  // Fire and forget — no await
  fetch(`${API}/api/analytics/event`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  }).catch(() => {}); // swallow all errors
}

// ── Typed helpers ────────────────────────────────────────────

export const Analytics = {
  updateViewed: (updateId: string) =>
    trackEvent({ eventType: "update_viewed", updateId }),

  updateSkipped: (updateId: string) =>
    trackEvent({ eventType: "update_skipped", updateId }),

  updateMarkedRead: (updateId: string) =>
    trackEvent({ eventType: "update_marked_read", updateId }),

  searchPerformed: (query: string, resultCount: number) =>
    trackEvent({ eventType: "search_performed", metadata: { query, resultCount } }),

  languageSwitched: (from: string, to: string, updateId?: string) =>
    trackEvent({ eventType: "language_switched", updateId, metadata: { from, to } }),

  notificationDismissed: (updateIds: string[]) =>
    trackEvent({ eventType: "notification_dismissed", metadata: { updateIds } }),
};
