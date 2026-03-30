"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HomeIcon, SearchIcon, TimelineIcon, ProfileIcon } from "./NavIcons";
import { UnreadBadge } from "./UnreadBadge";
import { useUnreadCount } from "@/hooks/useUnreadCount";
import { SearchBar } from "@/components/search/SearchBar";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", Icon: HomeIcon, showBadge: true },
  { href: "/search", label: "Search", Icon: SearchIcon, showBadge: false },
  { href: "/timeline", label: "Timeline", Icon: TimelineIcon, showBadge: false },
  { href: "/profile", label: "Profile", Icon: ProfileIcon, showBadge: false },
];

export function Sidebar() {
  const pathname = usePathname();
  const { unreadCount } = useUnreadCount();

  return (
    <aside className="hidden md:flex flex-col w-56 lg:w-64 shrink-0 h-screen sticky top-0 bg-brand-dark text-white border-r border-white/10">
      {/* Logo */}
      <div className="flex items-center gap-2 px-5 py-5 border-b border-white/10">
        <span className="text-brand font-bold text-lg leading-none">AWS</span>
        <span className="text-white/80 text-sm font-medium leading-tight">
          Updates<br />Platform
        </span>
      </div>

      {/* Search bar */}
      <div className="px-3 pb-3 border-b border-white/10">
        <SearchBar
          className="w-full"
          placeholder="Search updates…"
        />
      </div>

      {/* Nav links */}
      <nav className="flex-1 px-3 py-4 space-y-1" aria-label="Main navigation">
        {NAV_ITEMS.map(({ href, label, Icon, showBadge }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors min-h-tap",
                active
                  ? "bg-brand text-brand-dark"
                  : "text-white/70 hover:bg-white/10 hover:text-white"
              )}
              aria-current={active ? "page" : undefined}
            >
              <Icon className="w-5 h-5 shrink-0" />
              <span className="flex-1">{label}</span>
              {showBadge && <UnreadBadge count={unreadCount} />}
            </Link>
          );
        })}
      </nav>

      {/* Unread summary at bottom */}
      {unreadCount > 0 && (
        <div className="px-5 py-3 border-t border-white/10 text-xs text-white/50">
          {unreadCount} unread update{unreadCount !== 1 ? "s" : ""}
        </div>
      )}
    </aside>
  );
}
