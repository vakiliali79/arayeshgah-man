import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { Spinner } from "./spinner";

const variants = {
  primary:
    "bg-primary text-primary-foreground shadow-soft hover:bg-primary-800 active:bg-primary-900",
  gold: "bg-gradient-to-l from-gold-500 to-gold-400 text-white shadow-gold hover:from-gold-600 hover:to-gold-500",
  secondary: "bg-primary-50 text-primary-700 hover:bg-primary-100",
  outline: "border border-border bg-surface text-foreground hover:border-primary-300 hover:bg-primary-50/50",
  ghost: "text-foreground hover:bg-surface-muted",
  danger: "bg-danger text-white hover:brightness-95",
} as const;

const sizes = {
  sm: "h-9 px-3.5 text-sm gap-1.5 rounded-sm",
  md: "h-11 px-5 text-[0.95rem] gap-2 rounded-md",
  lg: "h-13 px-7 text-base gap-2.5 rounded-md",
  icon: "size-11 rounded-md",
} as const;

export type ButtonVariant = keyof typeof variants;
export type ButtonSize = keyof typeof sizes;

/** کلاس‌های دکمه؛ برای استفاده روی <Link> هم قابل استفاده است */
export function buttonVariants({
  variant = "primary",
  size = "md",
  fullWidth,
  className,
}: { variant?: ButtonVariant; size?: ButtonSize; fullWidth?: boolean; className?: string } = {}) {
  return cn(
    "inline-flex select-none items-center justify-center font-medium whitespace-nowrap transition-all duration-200",
    "disabled:pointer-events-none disabled:opacity-55 active:scale-[0.98]",
    variants[variant],
    sizes[size],
    fullWidth && "w-full",
    className,
  );
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant, size, fullWidth, loading, className, children, disabled, type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonVariants({ variant, size, fullWidth, className })}
      {...props}
    >
      {loading && <Spinner className="size-4" />}
      {children}
    </button>
  );
});
