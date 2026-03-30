import { Sidebar } from "@/components/nav/Sidebar";
import { BottomNav } from "@/components/nav/BottomNav";
import { SearchBar } from "@/components/search/SearchBar";
import { PriorityAlertsSheet } from "@/components/notifications/PriorityAlertsSheet";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Desktop sidebar */}
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile sticky header — branding + search bar */}
        <header className="md:hidden sticky top-0 z-40 bg-brand-dark text-white shrink-0">
          {/* Top row: logo */}
          <div className="flex items-center justify-between px-4 h-12">
            <span className="font-bold text-brand text-base">AWS</span>
            <span className="text-white/70 text-xs">Updates Platform</span>
          </div>
          {/* Search bar row — always visible on mobile */}
          <div className="px-3 pb-2">
            <SearchBar
              className="w-full"
              placeholder="Search services, keywords…"
            />
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 px-4 py-4 md:px-6 md:py-6 pb-20 md:pb-6 overflow-x-hidden">
          {children}
        </main>
      </div>

      <BottomNav />

      {/* Priority alerts popup — shown on dashboard load if unread alerts exist */}
      <PriorityAlertsSheet />
    </div>
  );
}
