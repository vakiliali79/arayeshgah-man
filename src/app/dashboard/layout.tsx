import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { NAV, SECTION_LABEL } from "@/components/dashboard/nav-config";
import { ROLE_META } from "@/config/roles";
import { db } from "@/db";
import { SessionKeepAlive } from "@/features/auth/components/session-keep-alive";
import { requireSession } from "@/server/auth/current";
import { getDashboardSections } from "@/server/dashboard/access";
import { unreadNotificationCount } from "@/server/notifications/service";

export const dynamic = "force-dynamic";

/** همه صفحات داشبورد: نشست معتبر لازم است؛ منو بر اساس نقش (سمت سرور) ساخته می‌شود */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { actor, profile, user } = await requireSession();
  const [sections, unread] = await Promise.all([getDashboardSections(db, actor), unreadNotificationCount(db, actor)]);
  return (
    <DashboardShell
      sections={sections.map((s) => ({ key: s, label: SECTION_LABEL[s], items: NAV[s] }))}
      user={{ name: profile.fullName ?? user.name, roleLabel: ROLE_META[profile.role].label, unread }}
    >
      {children}
      <SessionKeepAlive />
    </DashboardShell>
  );
}
