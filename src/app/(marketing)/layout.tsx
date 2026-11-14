import { MobileBottomNav, SiteFooter, SiteHeader } from "@/components/layout";
import { db } from "@/db";
import { getCurrentSession } from "@/server/auth/current";
import { getSetting } from "@/server/content/settings";

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const [session, contact, announcement] = await Promise.all([getCurrentSession(), getSetting(db, "contact"), getSetting(db, "announcement")]);
  return (
    <>
      {announcement?.active && announcement.text && (
        <div className="bg-primary-900 px-4 py-2 text-center text-xs text-primary-foreground sm:text-sm" role="status">{announcement.text}</div>
      )}
      <SiteHeader signedIn={Boolean(session)} />
      <main>{children}</main>
      <SiteFooter contact={contact} />
      <MobileBottomNav signedIn={Boolean(session)} />
    </>
  );
}
