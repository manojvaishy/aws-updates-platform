"use client";

import { useState, useEffect, useCallback } from "react";
import { Update, Priority } from "@/types";
import { mapUpdate } from "@/lib/updates";
import { groupUpdatesByDate } from "@/lib/groupByDate";
import { PriorityBadge } from "@/components/updates/PriorityBadge";
import { truncate, cn } from "@/lib/utils";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

const CATEGORIES = [
  "All", "Compute", "Storage", "Database", "Serverless",
  "Containers", "Analytics", "AI/ML", "Security", "Networking",
  "DevOps", "Infrastructure", "General",
];

const PRIORITIES: { value: Priority | ""; label: string }[] = [
  { value: "", label: "All priorities" },
  { value: "critical", label: "Critical" },
  { value: "high", label: "High" },
  { value: "normal", label: "Normal" },
];

interface Filters {
  category: string;
  priority: string;
  from: string;
  to: string;
}

export default function TimelinePage() {
  const [updates, setUpdates] = useState<Update[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<Filters>({
    category: "", priority: "", from: "", to: "",
  });
  const [applied, setApplied] = useState<Filters>(filters);

  const hasActive = applied.category || applied.priority || applied.from || applied.to;

  const fetchUpdates = useCallback(async (f: Filters) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (f.category && f.category !== "All") params.set("category", f.category);
      if (f.priority) params.set("priority", f.priority);
      if (f.from) params.set("from", f.from);
      if (f.to) params.set("to", f.to);

      const res = await fetch(`${API}/api/updates?${params}`);
      if (!res.ok) return;
      const json = await res.json();
      setUpdates((json.data ?? []).map(mapUpdate));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUpdates(applied); }, [fetchUpdates, applied]);

  function applyFilters() {
    setApplied({ ...filters });
    setShowFilters(false);
  }

  function clearFilters() {
    const empty = { category: "", priority: "", from: "", to: "" };
    setFilters(empty);
    setApplied(empty);
    setShowFilters(false);
  }

  const groups = groupUpdatesByDate(updates);

  return (
    <div className="max-w-3xl mx-auto space-y-4 overflow-x-hidden">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Timeline</h1>
          <p className="text-xs text-gray-400 mt-0.5">AWS updates grouped by date</p>
        </div>
        <button
          onClick={() => setShowFilters((v) => !v)}
          className={cn(
            "flex items-center gap-1.5 text-sm font-medium transition-colors min-h-tap px-3 py-1.5 rounded-lg border",
            hasActive
              ? "text-brand border-brand bg-orange-50"
              : "text-gray-500 border-gray-200 hover:border-gray-300"
          )}
        >
          <span aria-hidden="true">⚙</span>
          Filters
          {hasActive && (
            <span className="bg-brand text-white text-xs rounded-full px-1.5 py-0.5 leading-none">
              {[applied.category && applied.category !== "All", applied.priority, applied.from, applied.to].filter(Boolean).length}
            </span>
          )}
        </button>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
          {/* Category chips */}
          <div>
            <p className="text-xs font-medium text-gray-600 mb-2">Category</p>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setFilters((f) => ({ ...f, category: cat === "All" ? "" : cat }))}
                  className={cn(
                    "px-3 py-1 rounded-full text-xs transition-colors min-h-tap",
                    (cat === "All" ? !filters.category : filters.category === cat)
                      ? "bg-brand-dark text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Priority + date row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Priority</label>
              <select
                value={filters.priority}
                onChange={(e) => setFilters((f) => ({ ...f, priority: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-brand min-h-tap"
              >
                {PRIORITIES.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">From</label>
              <input
                type="date"
                value={filters.from}
                onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-brand min-h-tap"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">To</label>
              <input
                type="date"
                value={filters.to}
                onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-brand min-h-tap"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={applyFilters}
              className="flex-1 bg-brand-dark text-white py-2 rounded-lg text-sm font-medium hover:bg-brand-dark/90 transition-colors min-h-tap"
            >
              Apply
            </button>
            {hasActive && (
              <button
                onClick={clearFilters}
                className="px-4 py-2 rounded-lg text-sm text-gray-500 border border-gray-200 hover:bg-gray-50 transition-colors min-h-tap"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="space-y-6">
          {[1, 2].map((i) => (
            <div key={i} className="space-y-2">
              <div className="h-4 w-24 bg-gray-100 rounded animate-pulse" />
              {[1, 2, 3].map((j) => (
                <div key={j} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Empty */}
      {!loading && groups.length === 0 && (
        <p className="text-sm text-gray-500 text-center py-12">No updates match your filters.</p>
      )}

      {/* Date groups */}
      {!loading && groups.map((group) => (
        <section key={group.dateKey} aria-labelledby={`date-${group.dateKey}`}>
          <div className="flex items-center gap-3 mb-2">
            <h2
              id={`date-${group.dateKey}`}
              className="text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap"
            >
              {group.label}
            </h2>
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400">{group.updates.length}</span>
          </div>

          <div className="space-y-2">
            {group.updates.map((update) => (
              <div
                key={update.id}
                className="bg-white rounded-xl border border-gray-100 px-4 py-3 flex items-start gap-3 hover:border-gray-200 hover:shadow-sm transition-all"
              >
                <span
                  className={cn(
                    "mt-1.5 w-2 h-2 rounded-full shrink-0",
                    update.priority === "critical" ? "bg-red-500" :
                    update.priority === "high" ? "bg-orange-400" : "bg-gray-300"
                  )}
                  aria-hidden="true"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5 mb-1">
                    <PriorityBadge priority={update.priority} />
                    <span className="text-xs text-gray-400">{update.category}</span>
                  </div>
                  <p className="text-sm font-medium text-gray-900 leading-snug">{update.title}</p>
                  {update.simplifiedEn && (
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                      {truncate(update.simplifiedEn, 120)}
                    </p>
                  )}
                </div>
                <a
                  href={update.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-brand hover:underline shrink-0 min-h-tap flex items-center"
                  aria-label={`Open ${update.title} on AWS`}
                >
                  ↗
                </a>
              </div>
            ))}
          </div>
        </section>
      ))}

      {!loading && updates.length > 0 && (
        <div className="text-center pt-2">
          <Link href="/all-updates" className="text-sm text-brand hover:underline min-h-tap inline-flex items-center">
            View all updates →
          </Link>
        </div>
      )}
    </div>
  );
}
