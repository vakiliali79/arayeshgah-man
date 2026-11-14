import { db } from "@/db";
import { Categories, FeaturedSalons, ForBusiness, Hero, HowItWorks, TopStylists } from "@/features/home";
import { getHomeData } from "@/server/public/home";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const d = await getHomeData(db);
  return (
    <>
      <Hero salonCount={d.salonCount} stylistCount={d.stylistCount} avgRating={d.avgRating} />
      <Categories items={d.categories} />
      <FeaturedSalons salons={d.featuredSalons} />
      <HowItWorks />
      <TopStylists stylists={d.topStylists} />
      <ForBusiness />
    </>
  );
}
