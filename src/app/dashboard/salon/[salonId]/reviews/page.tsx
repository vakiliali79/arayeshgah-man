import type { Metadata } from "next";
import { db } from "@/db";
import { ReviewsList } from "@/features/dashboard/components/reviews-list";
import { toPersianDigits } from "@/lib/utils";
import { getSalonContext } from "@/server/dashboard/salon-context";
import { listReviewsFor } from "@/server/stylists/dashboard";

export const metadata: Metadata = { title: "نظرات سالن" };

export default async function SalonReviewsPage({ params }: PageProps<"/dashboard/salon/[salonId]/reviews">) {
  const { salonId } = await params;
  const { salon, access } = await getSalonContext(salonId);
  const rows = await listReviewsFor(db, { salonId: salon.id });
  return (
    <>
      {salon.ratingCount > 0 && <p className="mb-4 text-sm text-muted">میانگین امتیاز {toPersianDigits(salon.ratingAvg.toFixed(1))} از {toPersianDigits(salon.ratingCount)} نظر</p>}
      <ReviewsList rows={rows} canReply={access.permissions.has("manage_salon")} showStylist />
    </>
  );
}
