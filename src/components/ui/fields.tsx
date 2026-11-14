import { forwardRef, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const fieldBase =
  "w-full rounded-md border bg-surface px-4 text-[0.95rem] text-foreground transition-colors placeholder:text-muted/70 focus:outline-none focus:ring-4";
const tone = (invalid?: boolean) =>
  invalid ? "border-danger focus:ring-danger/15" : "border-border focus:border-primary-400 focus:ring-primary-100";

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }>(function Select(
  { className, invalid, children, ...props },
  ref,
) {
  return (
    <select ref={ref} aria-invalid={invalid || undefined} className={cn(fieldBase, "h-12 appearance-none bg-no-repeat", tone(invalid), className)} {...props}>
      {children}
    </select>
  );
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }>(function Textarea(
  { className, invalid, ...props },
  ref,
) {
  return <textarea ref={ref} aria-invalid={invalid || undefined} className={cn(fieldBase, "min-h-28 py-3 leading-7", tone(invalid), className)} {...props} />;
});

export function Checkbox({ label, className, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: React.ReactNode }) {
  return (
    <label className={cn("flex cursor-pointer items-start gap-2 text-sm", className)}>
      <input type="checkbox" className="mt-0.5 size-4 shrink-0 accent-primary-700" {...props} />
      <span>{label}</span>
    </label>
  );
}
