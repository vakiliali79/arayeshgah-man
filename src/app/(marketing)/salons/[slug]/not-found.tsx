import Link from "next/link";
import { SearchIcon } from "@/components/icons";
import { buttonVariants, EmptyState } from "@/components/ui";

/** صفحه موجود نیست یا (هنوز) عمومی نشده است */
export default function NotFound() {
  return (
    <div className="container-page py-16">
      <EmptyState
        icon={<SearchIcon />}
        title="این صفحه پیدا نشد"
        description="ممکن است این صفحه غیرفعال شده باشد یا هنوز توسط مدیریت تأیید نشده باشد."
        action={<Link href="/salons" className={buttonVariants({ size: "sm" })}>جستجوی سالن‌ها</Link>}
      />
    </div>
  );
}
