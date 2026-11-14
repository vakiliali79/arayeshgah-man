import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function SectionHeading({
  eyebrow,
  title,
  description,
  action,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-6 flex items-end justify-between gap-4 sm:mb-8", className)}>
      <div className="space-y-2">
        {eyebrow && <p className="text-xs font-semibold tracking-wide text-gold-500">{eyebrow}</p>}
        <h2 className="text-xl font-extrabold sm:text-2xl lg:text-3xl">{title}</h2>
        {description && <p className="max-w-xl text-sm text-muted sm:text-base">{description}</p>}
      </div>
      {action}
    </div>
  );
}
