import Link from "next/link";
import { buttonVariants, Logo } from "@/components/ui";
import { ROUTES } from "@/config/routes";

const navLinks = [
  { href: "#categories", label: "خدمات" },
  { href: "#salons", label: "سالن‌ها" },
  { href: "#how-it-works", label: "نحوه رزرو" },
  { href: "#for-business", label: "ویژه کسب‌وکارها" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Logo />
        <nav aria-label="ناوبری اصلی" className="hidden items-center gap-7 text-sm text-muted md:flex">
          {navLinks.map((l) => (
            <a key={l.href} href={l.href} className="transition-colors hover:text-primary-700">
              {l.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Link href={ROUTES.login} className={buttonVariants({ variant: "ghost", size: "sm", className: "hidden sm:inline-flex" })}>
            ورود
          </Link>
          <Link href={ROUTES.register} className={buttonVariants({ size: "sm" })}>
            ثبت‌نام
          </Link>
        </div>
      </div>
    </header>
  );
}
