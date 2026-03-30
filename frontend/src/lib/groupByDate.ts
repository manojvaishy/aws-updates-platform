import { Update } from "@/types";

export interface DateGroup {
  label: string;   // "Today", "Yesterday", "Jan 15, 2025"
  dateKey: string; // ISO date string for sorting/keying
  updates: Update[];
}

function toDateKey(dateStr: string): string {
  return new Date(dateStr).toISOString().slice(0, 10);
}

function toLabel(dateKey: string): string {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  if (dateKey === today) return "Today";
  if (dateKey === yesterday) return "Yesterday";

  return new Date(dateKey).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function groupUpdatesByDate(updates: Update[]): DateGroup[] {
  const map = new Map<string, Update[]>();

  for (const update of updates) {
    const key = toDateKey(update.publishedAt);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(update);
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => b.localeCompare(a)) // newest first
    .map(([dateKey, items]) => ({
      label: toLabel(dateKey),
      dateKey,
      updates: items,
    }));
}
