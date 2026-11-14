import { redirect } from "next/navigation";
import { db } from "@/db";
import { requireSession } from "@/server/auth/current";
import { defaultSectionPath, getDashboardSections } from "@/server/dashboard/access";

/** هدایت هر کاربر به داشبورد نقش خودش (پیام خوش‌آمد حفظ می‌شود) */
export default async function DashboardIndex({ searchParams }: PageProps<"/dashboard">) {
  const { actor } = await requireSession();
  const { welcome } = await searchParams;
  const path = defaultSectionPath(await getDashboardSections(db, actor));
  redirect(typeof welcome === "string" && /^[a-z]+$/.test(welcome) ? `${path}?welcome=${welcome}` : path);
}
