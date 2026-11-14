"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { NavItem } from "./nav-config";

/** منوی افقی بخش‌های داخلی (مثلاً هر سالن) */
export function SubNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav className="-mx-1 mb-6 flex gap-1 overflow-x-auto border-b border-border pb-2" aria-label="بخش‌های سالن">
      {items.map((item) => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn("shrink-0 rounded-md px-3 py-2 text-sm transition-colors", active ? "bg-primary-50 font-semibold text-primary-700" : "text-muted hover:text-foreground")}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
