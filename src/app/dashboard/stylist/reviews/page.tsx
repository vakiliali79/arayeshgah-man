import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { db } from "@/db";
import { ReviewsList } from "@/features/dashboard/components/reviews-list";
import { StylistOnboarding } from "@/features/dashboard/components/stylist-onboarding";
import { toPersianDigits } from "@/lib/utils";
import { getStylistContext } from "@/server/dashboard/stylist-context";
import { listReviewsFor } from "@/server/stylists/dashboard";

export const metadata: Metadata = { title: "نظرات مشتریان" };

export default async function StylistReviewsPage() {
  const { stylist } = await getStylistContext();
  if (!stylist) return <StylistOnboarding />;
  const rows = await listReviewsFor(db, { stylistId: stylist.id });
  return (
    <>
      <PageHeader
        title="نظرات مشتریان"
        description={stylist.ratingCount ? `میانگین امتیاز ${toPersianDigits(stylist.ratingAvg.toFixed(1))} از ${toPersianDigits(stylist.ratingCount)} نظر` : undefined}
      />
      <ReviewsList rows={rows} canReply />
    </>
  );
}
