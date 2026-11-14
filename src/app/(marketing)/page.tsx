import { Categories, FeaturedSalons, ForBusiness, Hero, HowItWorks, TopStylists } from "@/features/home";

export default function HomePage() {
  return (
    <>
      <Hero />
      <Categories />
      <FeaturedSalons />
      <HowItWorks />
      <TopStylists />
      <ForBusiness />
    </>
  );
}
