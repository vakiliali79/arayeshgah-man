import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { GUEST_ONLY_ROUTES, PROTECTED_PREFIXES, ROUTES } from "@/config/routes";
import type { Database } from "@/types/database";
import { getSupabaseEnv } from "./env";

/**
 * تازه‌سازی نشست کاربر در هر درخواست + محافظت از مسیرها.
 * بررسی دقیق نقش‌ها در لایه سرور (و RLS دیتابیس) انجام می‌شود.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const env = getSupabaseEnv();
  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));

  if (!env) {
    if (isProtected) return NextResponse.redirect(new URL(ROUTES.login, request.url));
    return response;
  }

  const supabase = createServerClient<Database>(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // getUser توکن را با سرور Supabase اعتبارسنجی می‌کند (برخلاف getSession)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && isProtected) {
    const url = new URL(ROUTES.login, request.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (user && (GUEST_ONLY_ROUTES as readonly string[]).includes(pathname)) {
    return NextResponse.redirect(new URL(ROUTES.dashboard, request.url));
  }

  return response;
}
