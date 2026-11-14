import { cn } from "@/lib/utils";

/** آواتار با حروف اول نام (در مراحل بعد تصویر هم پشتیبانی می‌شود) */
export function Avatar({ name, className }: { name: string; className?: string }) {
  const initials = name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("‌");
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex size-12 items-center justify-center rounded-full bg-gradient-to-br from-primary-100 to-gold-100 font-bold text-primary-700 ring-2 ring-surface",
        className,
      )}
    >
      {initials}
    </span>
  );
}
