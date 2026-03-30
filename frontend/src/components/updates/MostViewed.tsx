import Link from "next/link";
import { PriorityBadge } from "./PriorityBadge";
import { formatDate } from "@/lib/utils";
import { Priority } from "@/types";

interface PopularUpdate {
  id: string;
  title: string;
  category: string;
  priority: Priority;
  published_at: string;
  view_count: number;
}

interface MostViewedProps {
  updates: PopularUpdate[];
}

export function MostViewed({ updates }: MostViewedProps) {
  if (updates.length === 0) return null;

  return (
    <section aria-labelledby="most-viewed-heading">
      <h2
        id="most-viewed-heading"
        className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2"
      >
        <span aria-hidden="true">🔥</span> Most Viewed This Week
      </h2>

      <ol className="space-y-2">
        {updates.map((update, i) => (
          <li
            key={update.id}
            className="flex items-start gap-3 bg-white rounded-xl border border-gray-100 px-4 py-3 shadow-sm"
          >
            {/* Rank number */}
            <span className="text-lg font-bold text-gray-200 w-6 shrink-0 leading-tight">
              {i + 1}
            </span>

            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-1.5 mb-1">
                <PriorityBadge priority={update.priority} />
                <span className="text-xs text-gray-400">{update.category}</span>
              </div>
              <p className="text-sm font-medium text-gray-900 leading-snug line-clamp-2">
                {update.title}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {formatDate(update.published_at)} ·{" "}
                <span className="font-medium text-gray-500">
                  {update.view_count} view{update.view_count !== 1 ? "s" : ""}
                </span>
              </p>
            </div>
          </li>
        ))}
      </ol>

      <Link
        href="/all-updates"
        className="mt-3 block text-xs text-center text-brand hover:underline min-h-tap flex items-center justify-center"
      >
        See all updates →
      </Link>
    </section>
  );
}
