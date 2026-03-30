import { FeedList } from "@/components/updates/FeedList";
import { fetchUpdates } from "@/lib/updates";

export default async function AllUpdatesPage() {
  const { data: initialUpdates, total } = await fetchUpdates({ limit: 20 });

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">All Updates</h1>
        <p className="text-xs text-gray-400 mt-0.5">
          Every AWS announcement — unfiltered
        </p>
      </div>
      <FeedList initialUpdates={initialUpdates} initialTotal={total} />
    </div>
  );
}
