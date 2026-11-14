import type { Metadata } from "next";
import Link from "next/link";
import { Alert, buttonVariants } from "@/components/ui";
import { ROUTES } from "@/config/routes";
import { EmailRequestForm } from "@/features/auth";
import { getCurrentSession } from "@/server/auth/current";

export const metadata: Metadata = { title: "تأیید ایمیل" };

const errors: Record<string, string> = {
  TOKEN_EXPIRED: "لینک تأیید منقضی شده است.",
  INVALID_TOKEN: "لینک تأیید نامعتبر است.",
  USER_NOT_FOUND: "حساب کاربری مرتبط با این لینک پیدا نشد.",
};

/**
 * مقصد لینک تأیید ایمیل (callbackURL در Better Auth).
 * موفق: Better Auth نشست را می‌سازد و به اینجا هدایت می‌کند. ناموفق: ?error=CODE
 */
export default async function VerifyEmailPage({ searchParams }: PageProps<"/verify-email">) {
  const { error } = await searchParams;
  const session = await getCurrentSession();

  if (typeof error === "string" || !session) {
    return (
      <>
        <header className="mb-8 space-y-2">
          <h1 className="text-2xl font-extrabold sm:text-3xl">تأیید ایمیل</h1>
          <p className="text-sm text-muted">ایمیل خود را وارد کنید تا لینک تأیید جدید ارسال شود.</p>
        </header>
        {typeof error === "string" && (
          <Alert tone="danger" className="mb-5">
            {errors[error] ?? "تأیید ایمیل انجام نشد."}
          </Alert>
        )}
        <EmailRequestForm mode="verification" submitLabel="ارسال مجدد لینک تأیید" />
      </>
    );
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-extrabold sm:text-3xl">ایمیل شما تأیید شد</h1>
        <p className="text-sm text-muted">به آرایشگاه من خوش آمدید، {session.profile.fullName ?? session.user.name}.</p>
      </header>
      <Alert tone="success">حساب کاربری شما فعال است.</Alert>
      <Link href={ROUTES.dashboard} className={buttonVariants({ size: "lg", fullWidth: true })}>
        ورود به داشبورد
      </Link>
    </div>
  );
}
