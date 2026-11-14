import Link from "next/link";
import { Alert, buttonVariants } from "@/components/ui";
import { ROLE_META } from "@/config/roles";
import type { UserRole } from "@/db/types";

/**
 * دکمه شروع متناسب با وضعیت کاربر:
 * مهمان → ثبت‌نام با نقش مناسب؛ کاربر با همان نقش → داشبورد؛ نقش دیگر → توضیح و راه ارتباط
 */
export function OnboardingCta({ role, target, registerRole, dashboardHref, label }: { role: UserRole | null; target: UserRole; registerRole: string; dashboardHref: string; label: string }) {
  if (!role) {
    return (
      <div className="flex flex-wrap gap-3">
        <Link href={`/register?role=${registerRole}`} className={buttonVariants({ size: "lg" })}>{label}</Link>
        <Link href={`/login?next=${encodeURIComponent(dashboardHref)}`} className={buttonVariants({ size: "lg", variant: "outline" })}>قبلاً ثبت‌نام کرده‌ام</Link>
      </div>
    );
  }
  if (role === target || role === "admin") return <Link href={dashboardHref} className={buttonVariants({ size: "lg" })}>ادامه در داشبورد</Link>;
  return (
    <Alert tone="warning">
      حساب شما از نوع «{ROLE_META[role].label}» است. برای تغییر نوع حساب به «{ROLE_META[target].label}»، از صفحه <Link href="/support" className="font-semibold underline">پشتیبانی</Link> درخواست دهید.
    </Alert>
  );
}
