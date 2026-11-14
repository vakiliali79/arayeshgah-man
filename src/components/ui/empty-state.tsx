import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function EmptyState({ icon, title, description, action, className }: { icon?: ReactNode; title: string; description?: string; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center gap-3 rounded-lg border border-dashed border-border bg-surface/60 px-6 py-12 text-center", className)}>
      {icon && <span className="flex size-12 items-center justify-center rounded-full bg-primary-50 text-primary-600">{icon}</span>}
      <h3 className="font-bold">{title}</h3>
      {description && <p className="max-w-sm text-sm leading-7 text-muted">{description}</p>}
      {action}
    </div>
  );
}
