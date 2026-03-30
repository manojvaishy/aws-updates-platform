"use client";

import { useState, useCallback } from "react";

const KEY = "aws_recent_searches";
const MAX = 8;

function load(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}

function save(searches: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(searches));
  } catch {}
}

export function useRecentSearches() {
  const [recent, setRecent] = useState<string[]>(load);

  const add = useCallback((query: string) => {
    const q = query.trim();
    if (!q) return;
    setRecent((prev) => {
      const deduped = [q, ...prev.filter((s) => s.toLowerCase() !== q.toLowerCase())].slice(0, MAX);
      save(deduped);
      return deduped;
    });
  }, []);

  const remove = useCallback((query: string) => {
    setRecent((prev) => {
      const next = prev.filter((s) => s !== query);
      save(next);
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    save([]);
    setRecent([]);
  }, []);

  return { recent, add, remove, clear };
}
