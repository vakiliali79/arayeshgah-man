import Link from "next/link";
import { cn } from "@/lib/utils";

/** تب‌های مبتنی بر لینک (بدون JS؛ وضعیت در آدرس صفحه) */
export function TabLinks({ tabs, active }: { tabs: { key: string; label: string; href: string; count?: number }[]; active: string }) {
  return (
    <nav className="-mx-1 mb-5 flex gap-1 overflow-x-auto pb-1" aria-label="زبانه‌ها">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          aria-current={t.key === active ? "page" : undefined}
          className={cn(
            "shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors",
            t.key === active ? "bg-primary text-primary-foreground" : "bg-surface text-muted ring-1 ring-border hover:text-foreground",
          )}
        >
          {t.label}
          {t.count !== undefined && <span className="ms-1.5 opacity-80">({t.count.toLocaleString("fa-IR")})</span>}
        </Link>
      ))}
    </nav>
  );
}
