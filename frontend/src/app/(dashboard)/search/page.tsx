"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { SearchBar } from "@/components/search/SearchBar";
import { SearchResultCard } from "@/components/search/SearchResultCard";
import { mapUpdate } from "@/lib/updates";
import { Update, Priority } from "@/types";
import { cn } from "@/lib/utils";
import { useRecentSearches } from "@/hooks/useRecentSearches";
import { Analytics } from "@/lib/analytics";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

const PRIORITY_OPTIONS: { value: Priority | ""; label: string }[] = [
  { value: "", label: "Any priority" },
  { value: "critical", label: "Critical" },
  { value: "high", label: "High" },
  { value: "normal", label: "Normal" },
];

interface SearchFilters {
  q: string;
  service: string;
  priority: string;
  from: string;
  to: string;
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="h-8 bg-gray-100 rounded-lg animate-pulse w-full" />}>
      <SearchPageContent />
    </Suspense>
  );
}

function SearchPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [filters, setFilters] = useState<SearchFilters>({
    q:        searchParams.get("q") ?? "",
    service:  searchParams.get("service") ?? "",
    priority: searchParams.get("priority") ?? "",
    from:     searchParams.get("from") ?? "",
    to:       searchParams.get("to") ?? "",
  });

  const [results, setResults] = useState<Update[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const { recent, add: addRecent, remove: removeRecent, clear: clearRecent } = useRecentSearches();

  const hasActiveFilters = filters.service || filters.priority || filters.from || filters.to;

  const fetchResults = useCallback(async (f: SearchFilters) => {
    const params = new URLSearchParams();
    if (f.q)        params.set("q", f.q);
    if (f.service)  params.set("service", f.service);
    if (f.priority) params.set("priority", f.priority);
    if (f.from)     params.set("from", f.from);
    if (f.to)       params.set("to", f.to);

    if (!params.toString()) return;

    setLoading(true);
    try {
      const res = await fetch(`${API}/api/search?${params}&limit=20`);
      if (!res.ok) return;
      const json = await res.json();
      setResults((json.data ?? []).map(mapUpdate));
      setTotal(json.total ?? 0);
      // 13.3 — fire search_performed event
      Analytics.searchPerformed(f.q ?? "", json.total ?? 0);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch on mount if URL has params
  useEffect(() => {
    if (filters.q || filters.service || filters.priority || filters.from || filters.to) {
      fetchResults(filters);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSearch(q: string) {
    const next = { ...filters, q };
    setFilters(next);
    updateURL(next);
    fetchResults(next);
    addRecent(q);
  }

  function handleFilterChange(key: keyof SearchFilters, value: string) {
    const next = { ...filters, [key]: value };
    setFilters(next);
  }

  function applyFilters() {
    updateURL(filters);
    fetchResults(filters);
  }

  function clearFilters() {
    const next = { ...filters, service: "", priority: "", from: "", to: "" };
    setFilters(next);
    updateURL(next);
    fetchResults(next);
  }

  function updateURL(f: SearchFilters) {
    const params = new URLSearchParams();
    if (f.q)        params.set("q", f.q);
    if (f.service)  params.set("service", f.service);
    if (f.priority) params.set("priority", f.priority);
    if (f.from)     params.set("from", f.from);
    if (f.to)       params.set("to", f.to);
    router.replace(`/search?${params}`, { scroll: false });
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4 overflow-x-hidden">
      {/* Search bar */}
      <SearchBar
        defaultValue={filters.q}
        onSearch={handleSearch}
        autoFocus={!filters.q}
        placeholder="Search services, keywords…"
        className="w-full"
      />

      {/* Filter toggle */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setShowFilters((v) => !v)}
          className={cn(
            "text-sm font-medium transition-colors min-h-tap flex items-center gap-1.5",
            hasActiveFilters ? "text-brand" : "text-gray-500 hover:text-gray-700"
          )}
        >
          <span aria-hidden="true">⚙</span>
          Filters
          {hasActiveFilters && (
            <span className="ml-1 bg-brand text-white text-xs rounded-full px-1.5 py-0.5">
              {[filters.service, filters.priority, filters.from, filters.to].filter(Boolean).length}
            </span>
          )}
        </button>

        {total > 0 && (
          <p className="text-xs text-gray-400">{total} result{total !== 1 ? "s" : ""}</p>
        )}
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Service filter */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Service</label>
              <input
                type="text"
                value={filters.service}
                onChange={(e) => handleFilterChange("service", e.target.value)}
                placeholder="e.g. EC2, Lambda, S3"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-brand min-h-tap"
              />
            </div>

            {/* Priority filter */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Priority</label>
              <select
                value={filters.priority}
                onChange={(e) => handleFilterChange("priority", e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-brand min-h-tap"
              >
                {PRIORITY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            {/* Date from */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">From date</label>
              <input
                type="date"
                value={filters.from}
                onChange={(e) => handleFilterChange("from", e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-brand min-h-tap"
              />
            </div>

            {/* Date to */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">To date</label>
              <input
                type="date"
                value={filters.to}
                onChange={(e) => handleFilterChange("to", e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-brand min-h-tap"
              />
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={applyFilters}
              className="flex-1 bg-brand-dark text-white py-2 rounded-lg text-sm font-medium hover:bg-brand-dark/90 transition-colors min-h-tap"
            >
              Apply filters
            </button>
            {hasActiveFilters && (
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

      {/* Loading skeletons */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && filters.q && results.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500 text-sm">No results for &ldquo;{filters.q}&rdquo;</p>
          <p className="text-gray-400 text-xs mt-1">Try a different keyword or service name</p>
        </div>
      )}

      {/* Prompt / recent searches state */}
      {!loading && !filters.q && results.length === 0 && (
        <div className="space-y-4">
          {/* Recent searches */}
          {recent.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-gray-500">Recent searches</p>
                <button
                  onClick={clearRecent}
                  className="text-xs text-gray-400 hover:text-gray-600 min-h-tap flex items-center"
                >
                  Clear all
                </button>
              </div>
              <ul className="space-y-1">
                {recent.map((q) => (
                  <li key={q} className="flex items-center gap-2">
                    <button
                      onClick={() => handleSearch(q)}
                      className="flex-1 text-left text-sm text-gray-700 hover:text-brand transition-colors py-1.5 min-h-tap flex items-center gap-2"
                    >
                      <span className="text-gray-300" aria-hidden="true">↺</span>
                      {q}
                    </button>
                    <button
                      onClick={() => removeRecent(q)}
                      className="text-gray-300 hover:text-gray-500 min-h-tap min-w-tap flex items-center justify-center text-lg leading-none"
                      aria-label={`Remove "${q}" from recent searches`}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Quick search suggestions */}
          <div>
            <p className="text-xs font-medium text-gray-500 mb-2">Try searching for</p>
            <div className="flex flex-wrap gap-2">
              {["EC2", "Lambda", "S3", "deprecation", "cost optimization", "EKS"].map((hint) => (
                <button
                  key={hint}
                  onClick={() => handleSearch(hint)}
                  className="px-3 py-1.5 rounded-full bg-gray-100 text-gray-600 text-xs hover:bg-gray-200 transition-colors min-h-tap"
                >
                  {hint}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Results */}
      {!loading && results.length > 0 && (
        <div className="space-y-3">
          {results.map((update) => (
            <SearchResultCard
              key={update.id}
              update={update}
              query={filters.q}
              isRead={readIds.has(update.id)}
              onMarkRead={(id) => setReadIds((prev) => new Set(prev).add(id))}
              onMarkUnread={(id) => setReadIds((prev) => { const n = new Set(prev); n.delete(id); return n; })}
            />
          ))}
        </div>
      )}
    </div>
  );
}
