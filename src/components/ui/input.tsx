import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
  /** آیکون ابتدای فیلد (سمت راست در RTL) */
  startIcon?: ReactNode;
  /** المان انتهای فیلد (سمت چپ در RTL) */
  endAdornment?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, invalid, startIcon, endAdornment, dir, ...props },
  ref,
) {
  // جهت wrapper با جهت فیلد یکی باشد تا آیکون‌ها و padding درست قرار بگیرند
  return (
    <div className="relative" dir={dir}>
      {startIcon && (
        <span className="pointer-events-none absolute inset-y-0 start-3.5 flex items-center text-muted">{startIcon}</span>
      )}
      <input
        ref={ref}
        dir={dir}
        aria-invalid={invalid || undefined}
        className={cn(
          "h-12 w-full rounded-md border bg-surface px-4 text-[0.95rem] text-foreground transition-colors",
          "placeholder:text-muted/70 focus:outline-none focus:ring-4",
          invalid
            ? "border-danger focus:ring-danger/15"
            : "border-border focus:border-primary-400 focus:ring-primary-100",
          startIcon && "ps-11",
          endAdornment && "pe-12",
          className,
        )}
        {...props}
      />
      {endAdornment && <span className="absolute inset-y-0 end-1.5 flex items-center">{endAdornment}</span>}
    </div>
  );
});
