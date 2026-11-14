"use client";

import Link from "next/link";
import { useEffect } from "react";
import { AlertIcon } from "@/components/icons";
import { buttonVariants, EmptyState } from "@/components/ui";

/** خطای صفحات داشبورد (داخل منوی داشبورد نمایش داده می‌شود؛ منو قابل استفاده می‌ماند) */
export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[ui] dashboard error", error.digest ?? error.name);
  }, [error]);
  return (
    <EmptyState
      icon={<AlertIcon />}
      title="نمایش این بخش با خطا مواجه شد"
      description={`لطفاً دوباره تلاش کنید.${error.digest ? ` (کد پیگیری: ${error.digest})` : ""}`}
      action={
        <div className="flex flex-wrap justify-center gap-2">
          <button type="button" onClick={reset} className={buttonVariants({ size: "sm" })}>تلاش دوباره</button>
          <Link href="/dashboard" className={buttonVariants({ size: "sm", variant: "outline" })}>داشبورد من</Link>
        </div>
      }
      className="mt-8"
    />
  );
}
