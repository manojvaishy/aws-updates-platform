import { FeedList } from "@/components/updates/FeedList";
import { MostViewed } from "@/components/updates/MostViewed";
import { UserRole } from "@/types";
import { fetchUpdates } from "@/lib/updates";

// TODO: replace with real auth session in Phase 2
const MOCK_ROLE: UserRole = "developer";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

async function fetchPopular() {
  try {
    const res = await fetch(`${API}/api/analytics/popular`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return [];
    const json = await res.json();
    return json.data ?? [];
  } catch {
    return [];
  }
}

export default async function DashboardPage() {
  const [{ data: initialUpdates, total }, popular] = await Promise.all([
    fetchUpdates({ role: MOCK_ROLE, limit: 20 }),
    fetchPopular(),
  ]);

  return (
    <div className="max-w-3xl mx-auto space-y-6 overflow-x-hidden">
      <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>

      {/* Most Viewed — only shown when there's data */}
      {popular.length > 0 && (
        <MostViewed updates={popular} />
      )}

      {/* Main feed */}
      <FeedList
        userRole={MOCK_ROLE}
        initialUpdates={initialUpdates}
        initialTotal={total}
      />
    </div>
  );
}
