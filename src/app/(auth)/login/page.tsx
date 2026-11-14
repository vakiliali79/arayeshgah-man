import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ROUTES } from "@/config/routes";
import { LoginForm, type LoginNotice } from "@/features/auth";
import { safeRedirectPath } from "@/features/auth/redirect";
import { getCurrentSession } from "@/server/auth/current";

export const metadata: Metadata = { title: "ورود" };

const notices: Record<string, LoginNotice> = {
  session_expired: { tone: "warning", text: "نشست شما منقضی شده است. لطفاً دوباره وارد شوید." },
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next, notice } = await searchParams;
  const nextPath = typeof next === "string" ? safeRedirectPath(next) : undefined;

  // کاربر واردشده (نشست معتبر سمت سرور) به مقصد هدایت می‌شود
  if (await getCurrentSession()) redirect(nextPath ?? ROUTES.dashboard);

  return (
    <>
      <header className="mb-8 space-y-2">
        <h1 className="text-2xl font-extrabold sm:text-3xl">خوش برگشتید</h1>
        <p className="text-sm text-muted">شماره موبایل خود را وارد کنید تا کد ورود برایتان ارسال شود.</p>
      </header>
      <LoginForm next={nextPath} notice={typeof notice === "string" ? notices[notice] : undefined} />
    </>
  );
}
