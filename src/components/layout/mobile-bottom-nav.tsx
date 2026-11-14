"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarIcon, HomeIcon, SearchIcon, UserIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

/** ناوبری پایین صفحه — فقط موبایل */
export function MobileBottomNav({ signedIn }: { signedIn: boolean }) {
  const pathname = usePathname();
  const items = [
    { href: "/", label: "خانه", Icon: HomeIcon, match: (p: string) => p === "/" },
    { href: "/salons", label: "جستجو", Icon: SearchIcon, match: (p: string) => p.startsWith("/salons") || p.startsWith("/stylists") },
    { href: signedIn ? "/dashboard/customer/bookings" : "/login?next=/dashboard/customer/bookings", label: "نوبت‌ها", Icon: CalendarIcon, match: () => false },
    { href: signedIn ? "/dashboard" : "/login", label: "حساب من", Icon: UserIcon, match: (p: string) => p === "/login" },
  ];
  return (
    <nav aria-label="ناوبری موبایل" className="fixed inset-x-3 bottom-3 z-40 rounded-xl border border-border/70 bg-surface/90 shadow-lift backdrop-blur-xl md:hidden" style={{ marginBottom: "env(safe-area-inset-bottom)" }}>
      <ul className="grid grid-cols-4">
        {items.map(({ href, label, Icon, match }) => {
          const active = match(pathname);
          return (
            <li key={label}>
              <Link href={href} aria-current={active ? "page" : undefined} className={cn("flex flex-col items-center gap-1 py-2.5 text-[0.7rem]", active ? "text-primary-700" : "text-muted")}>
                <Icon size={22} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
