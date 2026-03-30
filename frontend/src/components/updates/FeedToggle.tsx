"use client";

import { cn } from "@/lib/utils";

export type FeedView = "my" | "all";

interface FeedToggleProps {
  view: FeedView;
  onChange: (view: FeedView) => void;
}

export function FeedToggle({ view, onChange }: FeedToggleProps) {
  return (
    <div
      className="inline-flex rounded-lg border border-gray-200 bg-gray-100 p-0.5"
      role="tablist"
      aria-label="Feed view"
    >
      {(["my", "all"] as FeedView[]).map((v) => (
        <button
          key={v}
          role="tab"
          aria-selected={view === v}
          onClick={() => onChange(v)}
          className={cn(
            "px-4 py-1.5 rounded-md text-sm font-medium transition-colors min-h-tap",
            view === v
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          )}
        >
          {v === "my" ? "My Feed" : "All Updates"}
        </button>
      ))}
    </div>
  );
}
