"use client";

import { Update } from "@/types";
import { PriorityBadge } from "@/components/updates/PriorityBadge";
import { Highlight } from "./Highlight";
import { formatDate, truncate, cn } from "@/lib/utils";

interface SearchResultCardProps {
  update: Update;
  query: string;
  isRead?: boolean;
  onMarkRead?: (id: string) => void;
  onMarkUnread?: (id: string) => void;
}

export function SearchResultCard({
  update,
  query,
  isRead = false,
  onMarkRead,
  onMarkUnread,
}: SearchResultCardProps) {
  const { id, title, simplifiedEn, category, priority, publishedAt, serviceTags } = update;

  return (
    <article
      className={cn(
        "bg-white rounded-xl border transition-shadow p-4",
        isRead ? "border-gray-100 opacity-70" : "border-gray-200 shadow-sm hover:shadow-md",
        priority === "critical" && !isRead && "border-l-4 border-l-red-500",
        priority === "high" && !isRead && "border-l-4 border-l-orange-400"
      )}
    >
      {/* Badges */}
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <PriorityBadge priority={priority} />
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
          {category}
        </span>
        {serviceTags.slice(0, 2).map((tag) => (
          <span key={tag} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-50 text-gray-600 border border-gray-100">
            <Highlight text={tag} query={query} />
          </span>
        ))}
      </div>

      {/* Title with highlight */}
      <h2 className={cn("text-sm font-semibold leading-snug mb-1", isRead ? "text-gray-400" : "text-gray-900")}>
        <Highlight text={title} query={query} />
      </h2>

      {/* Summary with highlight */}
      {simplifiedEn && (
        <p className="text-xs text-gray-500 leading-relaxed">
          <Highlight text={truncate(simplifiedEn, 160)} query={query} />
        </p>
      )}

      {/* Footer */}
      <div className="mt-2 flex items-center justify-between">
        <p className="text-xs text-gray-400">{formatDate(publishedAt)}</p>
        <button
          onClick={() => (isRead ? onMarkUnread?.(id) : onMarkRead?.(id))}
          className="text-xs text-gray-400 hover:text-brand transition-colors min-h-tap min-w-tap flex items-center"
          aria-label={isRead ? "Mark as unread" : "Mark as read"}
        >
          {isRead ? "↩ Unread" : "✓ Read"}
        </button>
      </div>
    </article>
  );
}
