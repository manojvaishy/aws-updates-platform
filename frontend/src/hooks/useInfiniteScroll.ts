"use client";

import { useEffect, useRef, useCallback } from "react";

/**
 * Calls `onLoadMore` when the sentinel element scrolls into view.
 * Uses IntersectionObserver — no scroll event listeners.
 */
export function useInfiniteScroll(
  onLoadMore: () => void,
  enabled: boolean
): React.RefObject<HTMLDivElement> {
  const sentinelRef = useRef<HTMLDivElement>(null);

  const handleIntersect = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      if (entries[0]?.isIntersecting && enabled) {
        onLoadMore();
      }
    },
    [onLoadMore, enabled]
  );

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(handleIntersect, {
      rootMargin: "200px", // trigger 200px before sentinel hits viewport
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [handleIntersect]);

  return sentinelRef;
}
