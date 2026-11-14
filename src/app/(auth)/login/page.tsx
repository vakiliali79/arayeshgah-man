import type { Metadata } from "next";
import { LoginForm } from "@/features/auth";
import { safeRedirectPath } from "@/features/auth/redirect";

export const metadata: Metadata = { title: "ورود" };

const notices: Record<string, string> = {
  auth_callback: "لینک تأیید نامعتبر یا منقضی شده است. لطفاً دوباره وارد شوید.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next, error } = await searchParams;
  const notice = typeof error === "string" ? notices[error] : undefined;

  return (
    <>
      <header className="mb-8 space-y-2">
        <h1 className="text-2xl font-extrabold sm:text-3xl">خوش برگشتید</h1>
        <p className="text-sm text-muted">برای مدیریت نوبت‌ها وارد حساب کاربری خود شوید.</p>
      </header>
      <LoginForm next={typeof next === "string" ? safeRedirectPath(next) : undefined} notice={notice} />
    </>
  );
}
