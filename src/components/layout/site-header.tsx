import Link from "next/link";
import { buttonVariants, Logo } from "@/components/ui";
import { ROUTES } from "@/config/routes";

export const MAIN_NAV = [
  { href: "/salons", label: "سالن‌ها" },
  { href: "/stylists", label: "آرایشگران" },
  { href: "/businesses", label: "ویژه کسب‌وکارها" },
  { href: "/support", label: "پشتیبانی" },
];

export function SiteHeader({ signedIn }: { signedIn: boolean }) {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Logo />
        <nav aria-label="ناوبری اصلی" className="hidden items-center gap-7 text-sm text-muted md:flex">
          {MAIN_NAV.map((l) => <Link key={l.href} href={l.href} className="transition-colors hover:text-primary-700">{l.label}</Link>)}
        </nav>
        <div className="flex items-center gap-2">
          {signedIn ? (
            <Link href={ROUTES.dashboard} className={buttonVariants({ size: "sm" })}>داشبورد من</Link>
          ) : (
            <>
              <Link href={ROUTES.login} className={buttonVariants({ variant: "ghost", size: "sm", className: "hidden sm:inline-flex" })}>ورود</Link>
              <Link href={ROUTES.register} className={buttonVariants({ size: "sm" })}>ثبت‌نام</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
