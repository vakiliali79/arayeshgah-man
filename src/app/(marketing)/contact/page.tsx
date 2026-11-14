import { MailIcon, MapPinIcon, PhoneIcon, ClockIcon } from "@/components/icons";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { db } from "@/db";
import { ContentHero } from "@/features/public/components/content-page";
import { TicketForm } from "@/features/public/components/ticket-form";
import { pageMetadata } from "@/lib/seo";
import { getSetting } from "@/server/content/settings";

export const metadata = pageMetadata("تماس با ما", "راه‌های ارتباط با آرایشگاه من و ارسال پیام به تیم ما.", "/contact");

export default async function ContactPage() {
  const c = await getSetting(db, "contact");
  const items = [
    c?.phone && { Icon: PhoneIcon, label: "تلفن", value: <a href={`tel:${c.phone}`} dir="ltr">{c.phone}</a> },
    c?.email && { Icon: MailIcon, label: "ایمیل", value: <a href={`mailto:${c.email}`} dir="ltr">{c.email}</a> },
    c?.hours && { Icon: ClockIcon, label: "ساعات پاسخگویی", value: c.hours },
    c?.address && { Icon: MapPinIcon, label: "نشانی", value: c.address },
  ].filter(Boolean) as { Icon: typeof PhoneIcon; label: string; value: React.ReactNode }[];
  return (
    <>
      <ContentHero eyebrow="تماس با ما" title="خوشحال می‌شویم از شما بشنویم" description="سؤال، پیشنهاد یا درخواست همکاری دارید؟ از فرم زیر برای ما پیام بفرستید." />
      <div className="container-page grid gap-6 py-10 lg:grid-cols-[1fr_1.4fr]">
        <Card>
          <CardHeader><CardTitle className="text-base">راه‌های ارتباطی</CardTitle></CardHeader>
          <CardContent>
            {items.length === 0 ? (
              <p className="text-sm leading-7 text-muted">اطلاعات تماس به‌زودی اعلام می‌شود. تا آن زمان، پیام خود را از طریق فرم ارسال کنید.</p>
            ) : (
              <ul className="space-y-4 text-sm">
                {items.map(({ Icon, label, value }) => (
                  <li key={label} className="flex items-start gap-3"><Icon size={18} className="mt-0.5 text-primary-600" /><div><p className="text-muted">{label}</p><p className="font-medium">{value}</p></div></li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">ارسال پیام</CardTitle></CardHeader>
          <CardContent><TicketForm kinds={[{ value: "contact", label: "تماس با ما" }]} /></CardContent>
        </Card>
      </div>
    </>
  );
}
