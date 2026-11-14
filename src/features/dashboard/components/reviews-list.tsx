import Link from "next/link";
import { StarIcon } from "@/components/icons";
import { Badge, EmptyState, Rating, Textarea } from "@/components/ui";
import { ActionForm } from "@/components/ui/action-form";
import { formatDate } from "@/lib/format/datetime";
import { replyReviewAction } from "../actions/provider";

interface ReviewRow {
  id: string;
  rating: number;
  comment: string | null;
  reply: string | null;
  isHidden: boolean;
  createdAt: Date;
  serviceName: string;
  stylistName: string;
  stylistSlug: string;
  customerName: string;
}

export function ReviewsList({ rows, canReply, showStylist }: { rows: ReviewRow[]; canReply: boolean; showStylist?: boolean }) {
  if (rows.length === 0) return <EmptyState icon={<StarIcon />} title="هنوز نظری ثبت نشده است" description="پس از انجام نوبت‌ها، مشتریان می‌توانند امتیاز و نظر ثبت کنند." />;
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.id} className="rounded-lg border border-border bg-surface p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-bold">{r.customerName}</p>
            <div className="flex items-center gap-2">
              {r.isHidden && <Badge tone="neutral">پنهان‌شده</Badge>}
              <Rating value={r.rating} />
            </div>
          </div>
          <p className="mt-1 text-xs text-muted">
            {r.serviceName}
            {showStylist && <> · <Link href={`/stylists/${r.stylistSlug}`} className="hover:underline">{r.stylistName}</Link></>} · {formatDate(r.createdAt)}
          </p>
          {r.comment && <p className="mt-2 text-sm leading-7">{r.comment}</p>}
          {r.reply ? (
            <p className="mt-2 rounded-md bg-surface-muted p-3 text-sm leading-7"><span className="font-semibold">پاسخ شما: </span>{r.reply}</p>
          ) : (
            canReply && (
              <details className="mt-2">
                <summary className="cursor-pointer text-sm font-medium text-primary-700">پاسخ به این نظر</summary>
                <ActionForm action={replyReviewAction} submitLabel="ثبت پاسخ" submitSize="sm" className="mt-2">
                  <input type="hidden" name="reviewId" value={r.id} />
                  <Textarea name="reply" required minLength={2} maxLength={2000} className="min-h-20" aria-label="متن پاسخ" />
                </ActionForm>
              </details>
            )
          )}
        </li>
      ))}
    </ul>
  );
}
