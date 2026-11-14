import { ROUTES } from "@/config/routes";

/** جلوگیری از Open Redirect: فقط مسیرهای داخلی نسبی پذیرفته می‌شوند */
export function safeRedirectPath(next: unknown, fallback: string = ROUTES.dashboard): string {
  if (typeof next !== "string") return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}
