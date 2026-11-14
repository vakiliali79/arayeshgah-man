import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const tones = {
  primary: "bg-primary-50 text-primary-700 ring-primary-100",
  gold: "bg-gold-50 text-gold-600 ring-gold-200",
  success: "bg-success-soft text-success ring-success/15",
  neutral: "bg-surface-muted text-muted ring-border",
} as const;

export function Badge({ tone = "primary", className, ...props }: HTMLAttributes<HTMLSpanElement> & { tone?: keyof typeof tones }) {
  return (
    <span
      className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset", tones[tone], className)}
      {...props}
    />
  );
}
