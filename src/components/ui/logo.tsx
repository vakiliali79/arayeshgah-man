import Link from "next/link";
import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <Link href="/" className={cn("inline-flex items-center gap-2.5", className)} aria-label="آرایشگاه من — صفحه اصلی">
      <span className="relative inline-flex size-9 items-center justify-center rounded-[0.8rem] bg-primary shadow-soft">
        <svg viewBox="0 0 24 24" className="size-5 text-gold-300" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
          <path d="M12 3c.6 4.4 2.6 6.4 7 7-4.4.6-6.4 2.6-7 7-.6-4.4-2.6-6.4-7-7 4.4-.6 6.4-2.6 7-7Z" />
        </svg>
      </span>
      <span className="text-lg font-black tracking-tight">
        آرایشگاه <span className="text-gradient-gold">من</span>
      </span>
    </Link>
  );
}
