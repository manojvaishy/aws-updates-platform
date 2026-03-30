"use client";

import { useState, useEffect, useCallback } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const POLL_INTERVAL = 60_000; // re-check every 60s

/**
 * Fetches unread count from GET /api/user/state and polls periodically.
 * Returns 0 when unauthenticated (no token).
 */
export function useUnreadCount(): {
  unreadCount: number;
  decrement: () => void;
} {
  const [unreadCount, setUnreadCount] = useState(0);

  const fetch_ = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const res = await fetch(`${API}/api/user/state`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const { unreadCount: count } = await res.json();
      setUnreadCount(typeof count === "number" ? count : 0);
    } catch {
      // fail silently
    }
  }, []);

  useEffect(() => {
    fetch_();
    const id = setInterval(fetch_, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [fetch_]);

  // Optimistic decrement when user marks something read
  const decrement = useCallback(() => {
    setUnreadCount((n) => Math.max(0, n - 1));
  }, []);

  return { unreadCount, decrement };
}
