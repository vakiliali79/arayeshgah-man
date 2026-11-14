import { redirect } from "next/navigation";
import { db } from "@/db";
import { requireSession } from "@/server/auth/current";
import { getManagedSalons } from "@/server/dashboard/access";

/** بخش سالن: نقش salon_owner/admin یا عضو مدیر/پذیرش یک سالن */
export default async function SalonSectionLayout({ children }: { children: React.ReactNode }) {
  const { actor } = await requireSession();
  if (actor.role !== "salon_owner" && actor.role !== "admin" && (await getManagedSalons(db, actor)).length === 0) redirect("/dashboard");
  return children;
}
