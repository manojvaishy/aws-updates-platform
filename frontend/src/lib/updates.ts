import { Update, UserRole } from "@/types";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapUpdate(u: any): Update {
  return {
    id: u.id,
    title: u.title,
    rawContent: u.raw_content ?? "",
    simplifiedEn: u.simplified_en ?? "",
    simplifiedHi: u.simplified_hi,
    simplifiedHinglish: u.simplified_hinglish,
    sourceUrl: u.source_url,
    publishedAt: u.published_at,
    category: u.category,
    serviceTags: u.service_tags ?? [],
    roleTags: u.role_tags ?? [],
    priority: u.priority,
  };
}

export async function fetchUpdates(opts: {
  role?: UserRole;
  limit?: number;
  page?: number;
} = {}): Promise<{ data: Update[]; total: number }> {
  const params = new URLSearchParams();
  if (opts.role) params.set("role", opts.role);
  if (opts.limit) params.set("limit", String(opts.limit));
  if (opts.page) params.set("page", String(opts.page));

  try {
    const res = await fetch(`${API}/api/updates?${params}`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return { data: [], total: 0 };
    const json = await res.json();
    return {
      data: (json.data ?? []).map(mapUpdate),
      total: json.total ?? 0,
    };
  } catch {
    return { data: [], total: 0 };
  }
}
