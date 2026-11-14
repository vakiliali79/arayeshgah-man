import type { Metadata } from "next";
import Link from "next/link";
import { Alert, buttonVariants } from "@/components/ui";
import { ROUTES } from "@/config/routes";
import { ResetPasswordForm } from "@/features/auth";

export const metadata: Metadata = { title: "انتخاب رمز عبور جدید" };

/**
 * Better Auth پس از بررسی لینک ایمیل به این صفحه هدایت می‌کند:
 *   /reset-password?token=…      یا      /reset-password?error=INVALID_TOKEN
 */
export default async function ResetPasswordPage({ searchParams }: PageProps<"/reset-password">) {
  const { token, error } = await searchParams;
  const valid = typeof token === "string" && token.length > 0 && !error;

  return (
    <>
      <header className="mb-8 space-y-2">
        <h1 className="text-2xl font-extrabold sm:text-3xl">انتخاب رمز عبور جدید</h1>
        <p className="text-sm text-muted">پس از ذخیره، از همه دستگاه‌ها خارج می‌شوید و باید با رمز جدید وارد شوید.</p>
      </header>
      {valid ? (
        <ResetPasswordForm token={token} />
      ) : (
        <div className="space-y-5">
          <Alert tone="danger">لینک بازیابی نامعتبر یا منقضی شده است. لطفاً دوباره درخواست دهید.</Alert>
          <Link href={ROUTES.forgotPassword} className={buttonVariants({ size: "lg", fullWidth: true })}>
            درخواست لینک جدید
          </Link>
        </div>
      )}
    </>
  );
}
