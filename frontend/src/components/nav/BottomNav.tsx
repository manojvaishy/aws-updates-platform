"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HomeIcon, SearchIcon, TimelineIcon, ProfileIcon } from "./NavIcons";
import { UnreadBadge } from "./UnreadBadge";
import { useUnreadCount } from "@/hooks/useUnreadCount";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Home", Icon: HomeIcon, showBadge: true },
  { href: "/search", label: "Search", Icon: SearchIcon, showBadge: false },
  { href: "/timeline", label: "Timeline", Icon: TimelineIcon, showBadge: false },
  { href: "/profile", label: "Profile", Icon: ProfileIcon, showBadge: false },
];

export function BottomNav() {
  const pathname = usePathname();
  const { unreadCount } = useUnreadCount();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 pb-safe md:hidden"
      aria-label="Main navigation"
    >
      <ul className="flex items-stretch h-16">
        {NAV_ITEMS.map(({ href, label, Icon, showBadge }) => {
          const active = pathname.startsWith(href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                className={cn(
                  "flex flex-col items-center justify-center w-full h-full gap-0.5 text-xs font-medium transition-colors",
                  active ? "text-brand" : "text-gray-500 hover:text-gray-800"
                )}
                aria-current={active ? "page" : undefined}
              >
                {/* Icon with badge overlay */}
                <span className="relative">
                  <Icon className="w-5 h-5" />
                  {showBadge && (
                    <UnreadBadge
                      count={unreadCount}
                      className="absolute -top-1.5 -right-2"
                    />
                  )}
                </span>
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
