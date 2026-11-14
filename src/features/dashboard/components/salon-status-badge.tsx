import { Badge } from "@/components/ui";

export function SalonStatusBadge({ isActive, isVerified }: { isActive: boolean; isVerified: boolean }) {
  if (!isActive) return <Badge tone="neutral">غیرفعال</Badge>;
  return isVerified ? <Badge tone="success">تأییدشده</Badge> : <Badge tone="gold">در انتظار تأیید مدیریت</Badge>;
}
