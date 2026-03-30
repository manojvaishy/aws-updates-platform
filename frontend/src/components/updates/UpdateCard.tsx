"use client";

import { Update } from "@/types";
import { PriorityBadge } from "./PriorityBadge";
import { formatDate, truncate, cn } from "@/lib/utils";
import { useSwipeAction } from "@/hooks/useSwipeAction";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Analytics } from "@/lib/analytics";

interface UpdateCardProps {
  update: Update;
  isRead?: boolean;
  onMarkRead?: (id: string) => void;
  onMarkUnread?: (id: string) => void;
  onClick?: (id: string) => void;
  /** Called with update ID when card scrolls into view */
  onVisible?: (id: string) => void;
  /** Registers the card's DOM element for scroll-to-last-seen */
  registerRef?: (el: HTMLElement | null) => void;
}

export function UpdateCard({
  update,
  isRead = false,
  onMarkRead,
  onMarkUnread,
  onClick,
  onVisible,
  registerRef,
}: UpdateCardProps) {
  const { id, title, simplifiedEn, category, priority, publishedAt, serviceTags } = update;

  const router = useRouter();
  const articleRef = useRef<HTMLElement>(null);
  const wasSeenRef = useRef(false);   // entered viewport
  const wasOpenedRef = useRef(false); // user clicked through

  // Register DOM ref for scroll-to-last-seen
  useEffect(() => {
    registerRef?.(articleRef.current);
    return () => registerRef?.(null);
  }, [registerRef]);

  // Fire onVisible + track skip behavior via IntersectionObserver
  useEffect(() => {
    if (!onVisible && !id) return;
    const el = articleRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          // Card entered viewport
          wasSeenRef.current = true;
          onVisible?.(id);
        } else if (wasSeenRef.current && !wasOpenedRef.current) {
          // Card left viewport without being opened → skipped
          Analytics.updateSkipped(id);
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [id, onVisible]);

  const { handlers, offset, isSwiping } = useSwipeAction({
    threshold: 60,
    onSwipeLeft: () => (isRead ? onMarkUnread?.(id) : onMarkRead?.(id)),
  });

  const showSwipeHint = offset < -20;

  return (
    <article
      ref={articleRef}
      className={cn(
        "relative bg-white rounded-xl border overflow-hidden transition-shadow",
        isRead
          ? "border-gray-100 opacity-70"
          : "border-gray-200 shadow-sm hover:shadow-md",
        priority === "critical" && !isRead && "border-l-4 border-l-red-500",
        priority === "high" && !isRead && "border-l-4 border-l-orange-400"
      )}
      aria-label={title}
    >
      {/* Swipe hint background (mobile) */}
      {showSwipeHint && (
        <div className="absolute inset-y-0 right-0 w-16 bg-green-500 flex items-center justify-center rounded-r-xl">
          <span className="text-white text-xs font-medium">
            {isRead ? "Unread" : "Read"}
          </span>
        </div>
      )}

      {/* Card content — slides left on swipe */}
      <div
        style={{
          transform: isSwiping ? `translateX(${offset}px)` : undefined,
          transition: isSwiping ? "none" : "transform 0.2s ease",
        }}
        {...handlers}
        className="bg-white rounded-xl"
      >
        {/* Clickable body */}
        <button
          className="w-full text-left p-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded-t-xl"
          onClick={() => { wasOpenedRef.current = true; onClick?.(id); router.push(`/updates/${id}`); }}
          aria-label={`Read update: ${title}`}
        >
          {/* Badges row */}
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <PriorityBadge priority={priority} />
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
              {category}
            </span>
            {serviceTags.slice(0, 2).map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-50 text-gray-600 border border-gray-100"
              >
                {tag}
              </span>
            ))}
            {/* Read indicator dot */}
            {isRead && (
              <span className="ml-auto text-xs text-gray-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-gray-300 inline-block" />
                Read
              </span>
            )}
          </div>

          {/* Title */}
          <h2
            className={cn(
              "text-sm font-semibold leading-snug mb-1 line-clamp-3",
              isRead ? "text-gray-400" : "text-gray-900"
            )}
          >
            {title}
          </h2>

          {/* Summary */}
          {simplifiedEn && (
            <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">
              {truncate(simplifiedEn, 140)}
            </p>
          )}

          {/* Date */}
          <p className="mt-2 text-xs text-gray-400">{formatDate(publishedAt)}</p>
        </button>

        {/* Footer: read/unread toggle (click on desktop, swipe on mobile) */}
        <div className="px-4 pb-3 flex items-center justify-between">
          <p className="text-xs text-gray-300 md:hidden">
            ← swipe to {isRead ? "unread" : "read"}
          </p>
          <button
            onClick={() => (isRead ? onMarkUnread?.(id) : onMarkRead?.(id))}
            className={cn(
              "ml-auto text-xs transition-colors min-h-tap min-w-tap flex items-center gap-1",
              isRead
                ? "text-gray-400 hover:text-brand"
                : "text-gray-400 hover:text-green-600"
            )}
            aria-label={isRead ? "Mark as unread" : "Mark as read"}
          >
            {isRead ? (
              <>
                <span aria-hidden="true">↩</span> Mark unread
              </>
            ) : (
              <>
                <span aria-hidden="true">✓</span> Mark read
              </>
            )}
          </button>
        </div>
      </div>
    </article>
  );
}
