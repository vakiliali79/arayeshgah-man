import Link from "next/link";
import { CalendarIcon, HomeIcon, SearchIcon, UserIcon } from "@/components/icons";
import { ROUTES } from "@/config/routes";

const items = [
  { href: ROUTES.home, label: "خانه", Icon: HomeIcon, active: true },
  { href: "#salons", label: "جستجو", Icon: SearchIcon },
  { href: ROUTES.dashboard, label: "نوبت‌ها", Icon: CalendarIcon },
  { href: ROUTES.login, label: "حساب من", Icon: UserIcon },
];

/** ناوبری پایین صفحه — فقط موبایل */
export function MobileBottomNav() {
  return (
    <nav
      aria-label="ناوبری موبایل"
      className="fixed inset-x-3 bottom-3 z-40 rounded-xl border border-border/70 bg-surface/90 shadow-lift backdrop-blur-xl md:hidden"
      style={{ marginBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="grid grid-cols-4">
        {items.map(({ href, label, Icon, active }) => (
          <li key={label}>
            <Link
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex flex-col items-center gap-1 py-2.5 text-[0.7rem] ${active ? "text-primary-700" : "text-muted"}`}
            >
              <Icon size={22} />
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
