"use client";

import { useRef, useState } from "react";

interface UseSwipeActionOptions {
  threshold?: number; // px to trigger action (default 60)
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
}

interface SwipeHandlers {
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchMove: (e: React.TouchEvent) => void;
  onTouchEnd: () => void;
}

interface UseSwipeActionReturn {
  handlers: SwipeHandlers;
  offset: number;     // current px offset (negative = left)
  isSwiping: boolean;
}

export function useSwipeAction({
  threshold = 60,
  onSwipeLeft,
  onSwipeRight,
}: UseSwipeActionOptions): UseSwipeActionReturn {
  const startX = useRef<number | null>(null);
  const [offset, setOffset] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);

  const onTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    setIsSwiping(true);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (startX.current === null) return;
    const delta = e.touches[0].clientX - startX.current;
    // Clamp: left swipe only if onSwipeLeft, right only if onSwipeRight
    const clamped =
      delta < 0 && onSwipeLeft ? Math.max(delta, -120)
      : delta > 0 && onSwipeRight ? Math.min(delta, 120)
      : 0;
    setOffset(clamped);
  };

  const onTouchEnd = () => {
    if (offset < -threshold) onSwipeLeft?.();
    else if (offset > threshold) onSwipeRight?.();
    setOffset(0);
    setIsSwiping(false);
    startX.current = null;
  };

  return {
    handlers: { onTouchStart, onTouchMove, onTouchEnd },
    offset,
    isSwiping,
  };
}
