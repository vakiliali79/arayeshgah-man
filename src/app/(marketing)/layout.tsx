import { MobileBottomNav, SiteFooter, SiteHeader } from "@/components/layout";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main>{children}</main>
      <SiteFooter />
      <MobileBottomNav />
    </>
  );
}
