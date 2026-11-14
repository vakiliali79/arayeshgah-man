"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarIcon, ChartIcon, ClockIcon, FileTextIcon, GridIcon, HeartIcon, HomeIcon, ImageIcon, InboxIcon,
  ScissorsIcon, SettingsIcon, ShieldIcon, StarIcon, StoreIcon, TagIcon, UserIcon, UsersIcon, BellIcon } from "@/components/icons";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import type { NavIcon, NavItem } from "./nav-config";

const ICONS: Record<NavIcon, (p: { size?: number }) => React.ReactElement> = {
  home: HomeIcon, calendar: CalendarIcon, heart: HeartIcon, star: StarIcon, user: UserIcon, scissors: ScissorsIcon,
  image: ImageIcon, clock: ClockIcon, store: StoreIcon, users: UsersIcon, chart: ChartIcon, settings: SettingsIcon,
  inbox: InboxIcon, tag: TagIcon, grid: GridIcon, file: FileTextIcon, shield: ShieldIcon, bell: BellIcon,
};

/** نشانگر «در حال بارگذاری» روی لینکی که کلیک شده تا صفحه مقصد آماده شود */
function PendingDot() {
  const { pending } = useLinkStatus();
  return pending ? <Spinner className="ms-auto size-4" /> : null;
}

export function NavLinks({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <ul className="space-y-1">
      {items.map((item) => {
        const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = ICONS[item.icon];
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors",
                active ? "bg-primary text-primary-foreground shadow-soft" : "text-muted hover:bg-surface-muted hover:text-foreground",
              )}
            >
              <Icon size={18} />
              {item.label}
              <PendingDot />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
