import Link from "next/link";
import { Logo } from "@/components/ui";
import { siteConfig } from "@/config/site";
import { toPersianDigits } from "@/lib/utils";
import type { SettingValue } from "@/server/content/settings";

const groups = [
  { title: "آرایشگاه من", links: [["درباره ما", "/about"], ["تماس با ما", "/contact"], ["فرصت‌های شغلی", "/careers"]] },
  { title: "کسب‌وکارها", links: [["ثبت سالن", "/register-salon"], ["همکاری آرایشگران", "/join-as-stylist"], ["تعرفه‌ها", "/pricing"]] },
  { title: "پشتیبانی", links: [["پشتیبانی", "/support"], ["سوالات متداول", "/faq"], ["قوانین و مقررات", "/terms"], ["حریم خصوصی", "/privacy"]] },
] as const;

export function SiteFooter({ contact }: { contact: SettingValue<"contact"> | null }) {
  return (
    <footer className="border-t border-border bg-surface pb-24 md:pb-0">
      <div className="container-page grid gap-10 py-12 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div className="space-y-4">
          <Logo />
          <p className="max-w-xs text-sm leading-7 text-muted">{siteConfig.description}</p>
          {(contact?.phone || contact?.email) && (
            <p className="text-sm text-muted">
              {contact.phone && <a href={`tel:${contact.phone}`} dir="ltr" className="block hover:text-primary-700">{contact.phone}</a>}
              {contact.email && <a href={`mailto:${contact.email}`} dir="ltr" className="block hover:text-primary-700">{contact.email}</a>}
            </p>
          )}
        </div>
        {groups.map((g) => (
          <div key={g.title} className="space-y-3">
            <h3 className="text-sm font-bold">{g.title}</h3>
            <ul className="space-y-2 text-sm text-muted">
              {g.links.map(([label, href]) => <li key={href}><Link href={href} className="transition-colors hover:text-primary-700">{label}</Link></li>)}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-border py-5 text-center text-xs text-muted">
        © {toPersianDigits(new Date().getFullYear())} {siteConfig.name} — تمامی حقوق محفوظ است.
      </div>
    </footer>
  );
}
