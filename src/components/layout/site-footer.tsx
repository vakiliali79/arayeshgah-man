import { Logo } from "@/components/ui";
import { siteConfig } from "@/config/site";
import { toPersianDigits } from "@/lib/utils";

const groups = [
  { title: "آرایشگاه من", links: ["درباره ما", "تماس با ما", "فرصت‌های شغلی"] },
  { title: "کسب‌وکارها", links: ["ثبت سالن", "همکاری آرایشگران", "تعرفه‌ها"] },
  { title: "پشتیبانی", links: ["سوالات متداول", "قوانین و مقررات", "حریم خصوصی"] },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-surface pb-24 md:pb-0">
      <div className="container-page grid gap-10 py-12 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div className="space-y-4">
          <Logo />
          <p className="max-w-xs text-sm leading-7 text-muted">{siteConfig.description}</p>
        </div>
        {groups.map((g) => (
          <div key={g.title} className="space-y-3">
            <h3 className="text-sm font-bold">{g.title}</h3>
            <ul className="space-y-2 text-sm text-muted">
              {g.links.map((l) => (
                <li key={l}>
                  <span className="cursor-default transition-colors hover:text-primary-700">{l}</span>
                </li>
              ))}
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
