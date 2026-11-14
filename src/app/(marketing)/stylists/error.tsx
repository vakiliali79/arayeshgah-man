"use client";

import { EmptyState } from "@/components/ui";
import { AlertIcon } from "@/components/icons";

/** حالت خطا (مثلاً قطع ارتباط با دیتابیس) با امکان تلاش دوباره */
export default function SearchError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="container-page py-16">
      <EmptyState
        icon={<AlertIcon />}
        title="نمایش نتایج با خطا مواجه شد"
        description="لطفاً چند لحظه دیگر دوباره تلاش کنید."
        action={<button type="button" onClick={reset} className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">تلاش دوباره</button>}
      />
    </div>
  );
}
