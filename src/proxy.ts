import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";
import { PROTECTED_PREFIXES, ROUTES } from "@/config/routes";
import { AUTH_COOKIE_PREFIX } from "@/server/auth/constants";

/**
 * بررسی خوش‌بینانه (optimistic) طبق توصیه Better Auth: فقط وجود کوکی نشست بررسی می‌شود
 * تا کاربر مهمان سریعاً به صفحه ورود هدایت شود. اعتبار واقعی نشست و نقش در خود صفحه
 * (requireSession) با دیتابیس بررسی می‌شود؛ هرگز فقط به این بررسی اعتماد نکنید.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (!isProtected) return NextResponse.next();

  if (!getSessionCookie(request, { cookiePrefix: AUTH_COOKIE_PREFIX })) {
    const url = new URL(ROUTES.login, request.url);
    url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
