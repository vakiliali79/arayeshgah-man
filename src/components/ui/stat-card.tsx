import type { ReactNode } from "react";
import { toPersianDigits } from "@/lib/utils";

export function StatCard({ label, value, icon, hint }: { label: string; value: number | string; icon?: ReactNode; hint?: string }) {
  const shown = typeof value === "number" ? toPersianDigits(value.toLocaleString("en-US")) : value;
  return (
    <div className="rounded-lg border border-border bg-surface p-4 shadow-soft">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted">{label}</p>
        {icon && <span className="text-gold-500">{icon}</span>}
      </div>
      <p className="mt-2 text-2xl font-extrabold">{shown}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}
