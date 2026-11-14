import { NextResponse, type NextRequest } from "next/server";
import { ROUTES } from "@/config/routes";
import { safeRedirectPath } from "@/features/auth/redirect";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

/** تبادل کد تأیید ایمیل (PKCE) با نشست کاربر */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeRedirectPath(searchParams.get("next"));

  if (code && isSupabaseConfigured()) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, origin));
  }

  return NextResponse.redirect(new URL(`${ROUTES.login}?error=auth_callback`, origin));
}
