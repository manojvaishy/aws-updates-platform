"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Update, UserRole } from "@/types";
import { UpdateCard } from "./UpdateCard";
import { FeedToggle, FeedView } from "./FeedToggle";
import { mapUpdate } from "@/lib/updates";
import { useInfiniteScroll } from "@/hooks/useInfiniteScroll";
import { useLastSeen } from "@/hooks/useLastSeen";

interface FeedListProps {
  userRole?: UserRole;
  initialUpdates: Update[];
  /** Total count from server — used to know when all pages are loaded */
  initialTotal?: number;
}

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const PAGE_SIZE = 20;

export function FeedList({ userRole, initialUpdates, initialTotal = 0 }: FeedListProps) {
  const [view, setView] = useState<FeedView>(userRole ? "my" : "all");
  const [updates, setUpdates] = useState<Update[]>(initialUpdates);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(initialTotal);
  const [loadingInitial, setLoadingInitial] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());

  // Track whether we've done the first client-side fetch (view change)
  const isFirstRender = useRef(true);

  const hasMore = updates.length < total;

  // ── Fetch a page of updates ──────────────────────────────────
  const fetchPage = useCallback(
    async (feedView: FeedView, pageNum: number, append: boolean) => {
      if (append) { setLoadingMore(true); } else { setLoadingInitial(true); }
      try {
        const params = new URLSearchParams({
          page: String(pageNum),
          limit: String(PAGE_SIZE),
        });
        if (feedView === "my" && userRole) params.set("role", userRole);

        const res = await fetch(`${API}/api/updates?${params}`);
        if (!res.ok) return;
        const json = await res.json();
        const newUpdates: Update[] = (json.data ?? []).map(mapUpdate);

        setTotal(json.total ?? 0);
        setUpdates((prev) => (append ? [...prev, ...newUpdates] : newUpdates));
        setPage(pageNum);
      } finally {
        if (append) { setLoadingMore(false); } else { setLoadingInitial(false); }
      }
    },
    [userRole]
  );

  // ── Re-fetch from page 1 when view toggles ───────────────────
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return; // skip — use server-provided initialUpdates
    }
    fetchPage(view, 1, false);
  }, [view, fetchPage]);

  // ── Load next page ───────────────────────────────────────────
  const loadMore = useCallback(() => {
    if (!loadingMore && hasMore) {
      fetchPage(view, page + 1, true);
    }
  }, [loadingMore, hasMore, fetchPage, view, page]);

  const sentinelRef = useInfiniteScroll(loadMore, hasMore && !loadingMore);

  // ── Last-seen scroll ─────────────────────────────────────────
  const { registerCard, saveLastSeen } = useLastSeen(updates.map((u) => u.id));

  // ── Handlers ─────────────────────────────────────────────────
  const handleViewChange = (v: FeedView) => {
    setUpdates([]);
    setPage(1);
    setView(v);
  };

  const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

  const handleMarkRead = useCallback((id: string) => {
    // Optimistic update
    setReadIds((prev) => new Set(prev).add(id));
    // Persist to backend (fire-and-forget — no auth token yet, Phase 2 will add it)
    fetch(`${API_BASE}/api/updates/${id}/read`, { method: "POST" }).catch(() => {
      // Rollback on failure
      setReadIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    });
  }, [API_BASE]);

  const handleMarkUnread = useCallback((id: string) => {
    // Optimistic update
    setReadIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    // Persist to backend
    fetch(`${API_BASE}/api/updates/${id}/unread`, { method: "POST" }).catch(() => {
      // Rollback on failure
      setReadIds((prev) => new Set(prev).add(id));
    });
  }, [API_BASE]);

  return (
    <div className="space-y-4">
      {/* Feed toggle */}
      {userRole && <FeedToggle view={view} onChange={handleViewChange} />}

      {/* Role label */}
      {view === "my" && userRole && (
        <p className="text-xs text-gray-400">
          Showing updates for{" "}
          <span className="font-medium text-gray-600">
            {userRole.replace(/_/g, " ")}
          </span>
        </p>
      )}

      {/* Initial loading skeletons */}
      {loadingInitial && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loadingInitial && updates.length === 0 && (
        <p className="text-sm text-gray-500 py-8 text-center">
          No updates found.
        </p>
      )}

      {/* Update cards */}
      {!loadingInitial && (
        <div className="space-y-3">
          {updates.map((update) => (
            <UpdateCard
              key={update.id}
              update={update}
              isRead={readIds.has(update.id)}
              onMarkRead={handleMarkRead}
              onMarkUnread={handleMarkUnread}
              onVisible={saveLastSeen}
              registerRef={(el) => registerCard(update.id, el)}
            />
          ))}
        </div>
      )}

      {/* Load-more skeleton (appending) */}
      {loadingMore && (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-28 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      )}

      {/* Sentinel — IntersectionObserver watches this */}
      <div ref={sentinelRef} aria-hidden="true" className="h-1" />

      {/* End of feed message */}
      {!hasMore && updates.length > 0 && !loadingInitial && (
        <p className="text-xs text-gray-400 text-center py-4">
          You&apos;re all caught up
        </p>
      )}
    </div>
  );
}
