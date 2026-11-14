import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";
import type { UserRole } from "@/config/roles";
import { ROUTES } from "@/config/routes";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

/** کاربر جاری + پروفایل (یک‌بار در هر درخواست) */
export const getCurrentUser = cache(async () => {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, phone, avatar_url, role, created_at, updated_at")
    .eq("id", user.id)
    .single();

  return { user, profile };
});

/** محافظ سمت سرور: کاربر باید وارد شده و (در صورت تعیین) نقش مجاز داشته باشد */
export async function requireUser(allowedRoles?: readonly UserRole[]) {
  const current = await getCurrentUser();
  if (!current) redirect(ROUTES.login);
  if (allowedRoles && (!current.profile || !allowedRoles.includes(current.profile.role))) {
    redirect(ROUTES.dashboard);
  }
  return current;
}
