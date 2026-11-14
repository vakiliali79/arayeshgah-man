import Link from "next/link";
import { buttonVariants } from "@/components/ui";
import { salonNav } from "@/components/dashboard/nav-config";
import { SubNav } from "@/components/dashboard/sub-nav";
import { getSalonContext } from "@/server/dashboard/salon-context";
import { SalonStatusBadge } from "@/features/dashboard/components/salon-status-badge";

export default async function SalonLayout({ children, params }: LayoutProps<"/dashboard/salon/[salonId]">) {
  const { salonId } = await params;
  const { salon } = await getSalonContext(salonId);
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/dashboard/salon" className="text-sm text-muted hover:text-foreground">سالن‌ها /</Link>
          <h1 className="text-xl font-extrabold">{salon.name}</h1>
          <SalonStatusBadge isActive={salon.isActive} isVerified={salon.isVerified} />
        </div>
        {salon.isActive && salon.isVerified && (
          <Link href={`/salons/${salon.slug}`} className={buttonVariants({ size: "sm", variant: "outline" })}>صفحه عمومی سالن</Link>
        )}
      </div>
      <SubNav items={salonNav(salon.id)} />
      {children}
    </>
  );
}
