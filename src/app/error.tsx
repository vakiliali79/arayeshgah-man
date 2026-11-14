"use client";

import Link from "next/link";
import { useEffect } from "react";
import { AlertIcon } from "@/components/icons";
import { buttonVariants } from "@/components/ui";

/** خطای پیش‌بینی‌نشده در صفحات عمومی و ورود؛ جزئیات فنی به کاربر نمایش داده نمی‌شود */
export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[ui] page error", error.digest ?? error.name);
  }, [error]);
  return (
    <main className="bg-luxe flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-danger-soft text-danger"><AlertIcon /></span>
      <h1 className="text-xl font-bold">مشکلی در نمایش این صفحه پیش آمد</h1>
      <p className="max-w-sm text-sm leading-7 text-muted">لطفاً دوباره تلاش کنید. اگر مشکل ادامه داشت، از صفحه پشتیبانی با ما در تماس باشید.</p>
      {error.digest && <p className="text-xs text-muted" dir="ltr">کد پیگیری خطا: {error.digest}</p>}
      <div className="flex flex-wrap justify-center gap-2">
        <button type="button" onClick={reset} className={buttonVariants({})}>تلاش دوباره</button>
        <Link href="/" className={buttonVariants({ variant: "outline" })}>صفحه اصلی</Link>
      </div>
    </main>
  );
}
