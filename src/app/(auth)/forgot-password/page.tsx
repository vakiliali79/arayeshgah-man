import type { Metadata } from "next";
import { EmailRequestForm } from "@/features/auth";

export const metadata: Metadata = { title: "فراموشی رمز عبور" };

export default function ForgotPasswordPage() {
  return (
    <>
      <header className="mb-8 space-y-2">
        <h1 className="text-2xl font-extrabold sm:text-3xl">فراموشی رمز عبور</h1>
        <p className="text-sm text-muted">ایمیل حساب خود را وارد کنید تا لینک انتخاب رمز جدید برایتان ارسال شود.</p>
      </header>
      <EmailRequestForm mode="password-reset" submitLabel="ارسال لینک بازیابی" />
    </>
  );
}
