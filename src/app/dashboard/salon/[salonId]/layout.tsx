import Link from "next/link";
import { Alert, buttonVariants } from "@/components/ui";
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
          <SalonStatusBadge isActive={salon.isActive} isVerified={salon.isVerified} rejectionReason={salon.rejectionReason} />
        </div>
        {salon.isActive && salon.isVerified && (
          <Link href={`/salons/${salon.slug}`} className={buttonVariants({ size: "sm", variant: "outline" })}>صفحه عمومی سالن</Link>
        )}
      </div>
      {salon.isActive && !salon.isVerified && (
        <Alert tone={salon.rejectionReason ? "danger" : "warning"} className="mb-4">
          {salon.rejectionReason ? (
            <>
              درخواست ثبت این سالن توسط مدیریت رد شد. دلیل: <strong>{salon.rejectionReason}</strong>. پس از اصلاح، اطلاعات را از{" "}
              <Link href={`/dashboard/salon/${salon.id}/settings`} className="font-semibold underline">اطلاعات و تصاویر</Link> ذخیره کنید تا دوباره بررسی شود.
            </>
          ) : (
            "این سالن در انتظار تأیید مدیریت است و تا زمان تأیید در جستجوی سایت نمایش داده نمی‌شود."
          )}
        </Alert>
      )}
      {!salon.isActive && <Alert tone="warning" className="mb-4">این سالن توسط مدیریت غیرفعال شده است و نوبت جدید نمی‌گیرد. برای پیگیری با پشتیبانی تماس بگیرید.</Alert>}
      <SubNav items={salonNav(salon.id)} />
      {children}
    </>
  );
}
