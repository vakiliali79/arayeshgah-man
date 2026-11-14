import { Badge } from "@/components/ui";

export function SalonStatusBadge({ isActive, isVerified, rejectionReason }: { isActive: boolean; isVerified: boolean; rejectionReason?: string | null }) {
  if (!isActive) return <Badge tone="neutral">غیرفعال</Badge>;
  if (isVerified) return <Badge tone="success">تأییدشده</Badge>;
  return rejectionReason ? <Badge tone="danger">درخواست رد شده</Badge> : <Badge tone="gold">در انتظار تأیید مدیریت</Badge>;
}
