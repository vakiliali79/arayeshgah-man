import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { db } from "@/db";
import { ContentHero } from "@/features/public/components/content-page";
import { TicketForm } from "@/features/public/components/ticket-form";
import { pageMetadata } from "@/lib/seo";
import { getCurrentSession } from "@/server/auth/current";
import { getSetting } from "@/server/content/settings";

export const metadata = pageMetadata("پشتیبانی", "درخواست پشتیبانی، پیگیری مشکل نوبت یا ثبت شکایت در آرایشگاه من.", "/support");

export default async function SupportPage() {
  const [session, contact] = await Promise.all([getCurrentSession(), getSetting(db, "contact")]);
  const phone = session?.profile.phone ?? (session?.user.phoneNumber ? `0${session.user.phoneNumber.slice(3)}` : undefined);
  return (
    <>
      <ContentHero eyebrow="پشتیبانی" title="چطور می‌توانیم کمک کنیم؟" description="پیش از ارسال درخواست، پاسخ پرسش‌های رایج را در صفحه سوالات متداول ببینید." />
      <div className="container-page grid gap-6 py-10 lg:grid-cols-[1fr_1.5fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">راهنمای سریع</CardTitle></CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                <li><Link href="/faq" className="text-primary-700 hover:underline">سوالات متداول</Link></li>
                <li><Link href="/dashboard/customer/bookings" className="text-primary-700 hover:underline">پیگیری و لغو نوبت‌های من</Link></li>
                <li><Link href="/terms" className="text-primary-700 hover:underline">قوانین لغو و رزرو</Link></li>
              </ul>
            </CardContent>
          </Card>
          {(contact?.phone || contact?.hours) && (
            <Card>
              <CardHeader><CardTitle className="text-base">تماس تلفنی</CardTitle></CardHeader>
              <CardContent className="text-sm">
                {contact.phone && <p dir="ltr" className="text-end font-bold">{contact.phone}</p>}
                {contact.hours && <p className="text-muted">{contact.hours}</p>}
              </CardContent>
            </Card>
          )}
        </div>
        <Card>
          <CardHeader><CardTitle className="text-base">ارسال درخواست</CardTitle></CardHeader>
          <CardContent>
            <TicketForm
              kinds={[{ value: "support", label: "درخواست پشتیبانی" }, { value: "complaint", label: "ثبت شکایت" }]}
              defaults={{ name: session?.profile.fullName ?? undefined, phone }}
            />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
