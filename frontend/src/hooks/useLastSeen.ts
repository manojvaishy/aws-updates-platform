"use client";

import { useEffect, useRef, useCallback } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

/**
 * Manages last-seen scroll position for the feed.
 *
 * - On mount: fetches last-seen update ID from the API, scrolls to that card
 * - On scroll: debounces and saves the topmost visible card as last-seen
 */
export function useLastSeen(updateIds: string[]) {
  // Map of updateId → DOM element ref
  const cardRefs = useRef<Map<string, HTMLElement>>(new Map());
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasScrolled = useRef(false);

  // Register a card element by update ID
  const registerCard = useCallback((id: string, el: HTMLElement | null) => {
    if (el) {
      cardRefs.current.set(id, el);
    } else {
      cardRefs.current.delete(id);
    }
  }, []);

  // Scroll to last-seen card on initial load
  useEffect(() => {
    if (hasScrolled.current || updateIds.length === 0) return;

    async function scrollToLastSeen() {
      try {
        const res = await fetch(`${API}/api/user/state`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token") ?? ""}`,
          },
        });
        if (!res.ok) return;
        const { lastSeenUpdateId } = await res.json();
        if (!lastSeenUpdateId) return;

        // Wait for cards to be in the DOM
        const el = cardRefs.current.get(lastSeenUpdateId);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
          hasScrolled.current = true;
        }
      } catch {
        // Fail silently — not critical
      }
    }

    // Small delay to let cards render
    const t = setTimeout(scrollToLastSeen, 300);
    return () => clearTimeout(t);
  }, [updateIds]);

  // Save last-seen as user scrolls (debounced 1s)
  const saveLastSeen = useCallback((updateId: string) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      fetch(`${API}/api/user/state/last-seen`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token") ?? ""}`,
        },
        body: JSON.stringify({ updateId }),
      }).catch(() => {});
    }, 1000);
  }, []);

  return { registerCard, saveLastSeen };
}
