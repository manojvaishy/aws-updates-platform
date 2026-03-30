"use client";

import { useEffect, useState, useCallback } from "react";
import { PriorityBadge } from "@/components/updates/PriorityBadge";
import { formatDate, cn } from "@/lib/utils";
import { Priority } from "@/types";
import { Analytics } from "@/lib/analytics";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const DISMISSED_KEY = "aws_alerts_dismissed_at";

interface Alert {
  id: string;
  title: string;
  simplified_en: string | null;
  published_at: string;
  category: string;
  priority: Priority;
  source_url: string;
}

export function PriorityAlertsSheet() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [open, setOpen] = useState(false);

  const fetchAlerts = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) return;

    // Don't show again if dismissed in the last 30 minutes
    const dismissedAt = localStorage.getItem(DISMISSED_KEY);
    if (dismissedAt && Date.now() - Number(dismissedAt) < 30 * 60 * 1000) return;

    try {
      const res = await fetch(`${API}/api/updates/priority`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const json = await res.json();
      const data: Alert[] = json.data ?? [];
      if (data.length > 0) {
        setAlerts(data);
        setOpen(true);
      }
    } catch {
      // fail silently
    }
  }, []);

  useEffect(() => {
    // Small delay so the dashboard renders first
    const t = setTimeout(fetchAlerts, 800);
    return () => clearTimeout(t);
  }, [fetchAlerts]);

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    // 13.5 — fire notification_dismissed event
    Analytics.notificationDismissed(alerts.map((a) => a.id));
    setOpen(false);
  }

  async function acknowledgeAll() {
    const token = localStorage.getItem("token");
    if (!token) return;

    // Persist acknowledgment to DB — won't reappear in future sessions
    await fetch(`${API}/api/user/alerts/acknowledge`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ updateIds: alerts.map((a) => a.id) }),
    }).catch(() => {});

    dismiss();
  }

  if (!open || alerts.length === 0) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/40 md:flex md:items-center md:justify-center"
        onClick={dismiss}
        aria-hidden="true"
      />

      {/* Sheet — bottom sheet on mobile, centered modal on desktop */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="alerts-title"
        className={cn(
          "fixed z-50 bg-white shadow-xl",
          // Mobile: bottom sheet
          "bottom-0 left-0 right-0 rounded-t-2xl pb-safe max-h-[80vh] overflow-y-auto",
          // Desktop: centered modal
          "md:bottom-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2",
          "md:rounded-2xl md:w-full md:max-w-lg md:max-h-[80vh]"
        )}
      >
        {/* Handle bar (mobile) */}
        <div className="flex justify-center pt-3 pb-1 md:hidden">
          <div className="w-10 h-1 rounded-full bg-gray-300" />
        </div>

        <div className="px-5 py-4">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 id="alerts-title" className="text-base font-semibold text-gray-900 flex items-center gap-2">
                <span aria-hidden="true">⚠️</span>
                {alerts.length} Priority Alert{alerts.length !== 1 ? "s" : ""}
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Unread updates that need your attention
              </p>
            </div>
            <button
              onClick={dismiss}
              className="text-gray-400 hover:text-gray-600 min-h-tap min-w-tap flex items-center justify-center text-xl leading-none"
              aria-label="Dismiss alerts"
            >
              ×
            </button>
          </div>

          {/* Alert list */}
          <ul className="space-y-3">
            {alerts.map((alert) => (
              <li
                key={alert.id}
                className={cn(
                  "rounded-xl border p-3",
                  alert.priority === "critical"
                    ? "border-red-200 bg-red-50"
                    : "border-orange-200 bg-orange-50"
                )}
              >
                <div className="flex flex-wrap items-start gap-2 mb-1">
                  <PriorityBadge priority={alert.priority} />
                  <span className="text-xs text-gray-500">{alert.category}</span>
                  <span className="ml-auto text-xs text-gray-400 shrink-0">{formatDate(alert.published_at)}</span>
                </div>
                <p className="text-sm font-medium text-gray-900 leading-snug">{alert.title}</p>
                {alert.simplified_en && (
                  <p className="text-xs text-gray-600 mt-1 line-clamp-2">{alert.simplified_en}</p>
                )}
                <a
                  href={alert.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-brand hover:underline mt-1.5 min-h-tap"
                >
                  Read on AWS ↗
                </a>
              </li>
            ))}
          </ul>

          {/* Actions */}
          <div className="flex gap-2 mt-4">
            <button
              onClick={acknowledgeAll}
              className="flex-1 bg-brand-dark text-white py-2.5 rounded-xl text-sm font-medium hover:bg-brand-dark/90 transition-colors min-h-tap"
            >
              Mark all as read
            </button>
            <button
              onClick={dismiss}
              className="px-4 py-2.5 rounded-xl text-sm text-gray-500 border border-gray-200 hover:bg-gray-50 transition-colors min-h-tap"
            >
              Later
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
