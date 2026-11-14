import type { ReactNode } from "react";
import { AlertIcon, CheckIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

const tones = {
  danger: "bg-danger-soft text-danger border-danger/20",
  success: "bg-success-soft text-success border-success/20",
  warning: "bg-warning-soft text-warning border-warning/20",
} as const;

export function Alert({ tone = "danger", children, className }: { tone?: keyof typeof tones; children: ReactNode; className?: string }) {
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cn("flex items-start gap-2.5 rounded-md border p-3.5 text-sm", tones[tone], className)}>
      {tone === "success" ? <CheckIcon size={18} className="mt-0.5 shrink-0" /> : <AlertIcon size={18} className="mt-0.5 shrink-0" />}
      <div className="leading-6">{children}</div>
    </div>
  );
}
