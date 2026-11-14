"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

const MIN_INTERVAL_MS = 10 * 60_000; // حداکثر هر ۱۰ دقیقه یک بررسی
const PERIODIC_MS = 6 * 60 * 60_000; // برای زبانه‌هایی که روزها باز می‌مانند

/**
 * تمدید نشست کاربر واردشده: Better Auth در مسیر /api/auth/get-session (که می‌تواند کوکی ست کند)
 * هر ۲۴ ساعت یک‌بار نشست دیتابیس و کوکی (HttpOnly) را دوباره ۳۰ روز تمدید می‌کند.
 * هیچ توکنی در localStorage یا JS نگهداری نمی‌شود. اگر نشست در جای دیگری باطل شده باشد
 * (خروج، تعلیق حساب)، صفحه تازه می‌شود تا وضعیت واقعی نمایش داده شود.
 */
export function SessionKeepAlive() {
  const router = useRouter();
  useEffect(() => {
    let last = 0;
    let stopped = false;
    const ping = () => {
      const now = Date.now();
      if (stopped || now - last < MIN_INTERVAL_MS) return;
      last = now;
      fetch("/api/auth/get-session", { credentials: "same-origin", cache: "no-store", headers: { accept: "application/json" } })
        .then((r) => (r.ok ? r.json() : undefined))
        .then((data) => {
          if (data === null && !stopped) {
            stopped = true;
            router.refresh();
          }
        })
        .catch(() => {
          // خطای شبکه: در نوبت بعد دوباره تلاش می‌شود
          last = 0;
        });
    };
    ping();
    const onVisible = () => {
      if (document.visibilityState === "visible") ping();
    };
    document.addEventListener("visibilitychange", onVisible);
    const timer = window.setInterval(ping, PERIODIC_MS);
    return () => {
      stopped = true;
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(timer);
    };
  }, [router]);
  return null;
}
