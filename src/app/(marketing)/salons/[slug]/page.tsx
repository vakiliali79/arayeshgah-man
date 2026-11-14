import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { CalendarIcon, MapPinIcon, PhoneIcon, UsersIcon } from "@/components/icons";
import { buttonVariants, EmptyState, Rating } from "@/components/ui";
import { siteConfig } from "@/config/site";
import { db } from "@/db";
import { StylistCard } from "@/features/public/components/cards";
import { AvailabilityList, FavoriteButton, JsonLd, MapLinks, OfferingsList, PortfolioGrid, ReviewsList, Section, WeeklyHours } from "@/features/public/components/detail";
import { bookHref } from "@/lib/booking-links";
import { fileUrl } from "@/lib/files";
import { pageMetadata } from "@/lib/seo";
import { toPersianDigits } from "@/lib/utils";
import { getCurrentSession } from "@/server/auth/current";
import { isFavorite } from "@/server/favorites/service";
import { getPublicSalon } from "@/server/public/details";
import { currentTime } from "@/server/time";

const load = cache((slug: string) => getPublicSalon(db, slug, currentTime()));

export async function generateMetadata({ params }: PageProps<"/salons/[slug]">): Promise<Metadata> {
  const data = await load((await params).slug);
  if (!data) return { title: "سالن پیدا نشد", robots: { index: false } };
  const { salon } = data;
  const description = (salon.description ?? `${salon.name} در ${salon.city}؛ خدمات، قیمت‌ها، نظرات و رزرو آنلاین نوبت.`).slice(0, 160);
  const meta = pageMetadata(salon.name, description, `/salons/${salon.slug}`);
  const cover = fileUrl(salon.coverFileId);
  if (cover) {
    meta.openGraph = { ...meta.openGraph, images: [{ url: cover }] };
    meta.twitter = { ...meta.twitter, images: [cover] };
  }
  return meta;
}

export default async function SalonPage({ params }: PageProps<"/salons/[slug]">) {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) notFound();
  const { salon, offerings, team, hours, portfolio, reviews, availability } = data;
  const session = await getCurrentSession();
  const favorited = session ? await isFavorite(db, session.user.id, { salonId: salon.id }) : false;
  const path = `/salons/${salon.slug}`;
  const cover = fileUrl(salon.coverFileId);
  const location = [salon.city, salon.district].filter(Boolean).join("، ");

  return (
    <div className="container-page space-y-6 py-6 sm:py-10">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BeautySalon",
          name: salon.name,
          url: `${siteConfig.url.replace(/\/$/, "")}${path}`,
          address: { "@type": "PostalAddress", addressLocality: salon.city, streetAddress: salon.address },
          ...(salon.phone ? { telephone: salon.phone } : {}),
          ...(salon.latitude && salon.longitude ? { geo: { "@type": "GeoCoordinates", latitude: salon.latitude, longitude: salon.longitude } } : {}),
          ...(salon.ratingCount > 0 ? { aggregateRating: { "@type": "AggregateRating", ratingValue: salon.ratingAvg, reviewCount: salon.ratingCount } } : {}),
        }}
      />
      <nav aria-label="مسیر" className="text-xs text-muted">
        <Link href="/" className="hover:underline">خانه</Link> / <Link href="/salons" className="hover:underline">سالن‌ها</Link> / <span>{salon.name}</span>
      </nav>

      <header className="overflow-hidden rounded-lg border border-border bg-surface">
        <div className="relative aspect-[3/1] min-h-40 bg-gradient-to-br from-primary-200 to-gold-100">
          {cover ? (
            <Image src={cover} alt={salon.name} fill unoptimized priority sizes="100vw" className="object-cover" />
          ) : (
            <span className="absolute inset-0 flex items-center justify-center text-6xl font-black text-primary-700/25" aria-hidden>{salon.name.slice(0, 1)}</span>
          )}
        </div>
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-end sm:justify-between sm:p-6">
          <div className="space-y-2">
            <h1 className="text-2xl font-extrabold sm:text-3xl">{salon.name}</h1>
            <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
              {salon.ratingCount > 0 ? <Rating value={salon.ratingAvg} count={salon.ratingCount} /> : <span>هنوز نظری ثبت نشده</span>}
              <span className="inline-flex items-center gap-1"><MapPinIcon size={16} /> {location}</span>
              {team.length > 0 && <span className="inline-flex items-center gap-1"><UsersIcon size={16} /> {toPersianDigits(team.length)} آرایشگر</span>}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <FavoriteButton loggedIn={!!session} favorited={favorited} target={{ salonId: salon.id }} returnTo={path} />
            {offerings.length > 0 && (
              <Link href={bookHref({ salon: salon.slug })} className={buttonVariants({ size: "md" })}><CalendarIcon size={18} /> رزرو نوبت</Link>
            )}
          </div>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="min-w-0 space-y-6">
          {salon.description && (
            <Section id="about" title="درباره سالن"><p className="leading-8 whitespace-pre-line">{salon.description}</p></Section>
          )}
          <Section id="services" title="خدمات و قیمت‌ها"><OfferingsList offerings={offerings} groupBy="service" /></Section>
          <Section id="availability" title="نزدیک‌ترین زمان‌های آزاد"><AvailabilityList items={availability} salonSlug={salon.slug} /></Section>
          <Section id="team" title="آرایشگران این سالن">
            {team.length === 0 ? (
              <EmptyState icon={<UsersIcon />} title="هنوز آرایشگری معرفی نشده است" className="py-8" />
            ) : (
              <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                {team.map((t) => <li key={t.id}><StylistCard s={{ id: t.id, name: t.name, slug: t.slug, specialties: t.specialties, ratingAvg: t.ratingAvg, ratingCount: t.ratingCount, avatarFileId: t.avatarFileId }} /></li>)}
              </ul>
            )}
          </Section>
          <Section id="portfolio" title="نمونه‌کارها"><PortfolioGrid items={portfolio} /></Section>
          <Section id="reviews" title={`نظرات مشتریان${reviews.length ? ` (${toPersianDigits(reviews.length)})` : ""}`}>
            <ReviewsList reviews={reviews} loggedIn={!!session} returnTo={path} showStylist />
          </Section>
        </div>
        <aside className="space-y-6 lg:sticky lg:top-24 lg:h-fit">
          <Section title="ساعات کاری"><WeeklyHours hours={hours} /></Section>
          <Section title="نشانی و تماس">
            <div className="space-y-3 text-sm">
              <p className="leading-7">{salon.address}</p>
              {salon.phone && (
                <a href={`tel:${salon.phone}`} className="inline-flex items-center gap-2 font-medium text-primary-700 hover:underline" dir="ltr">
                  <PhoneIcon size={16} /> {toPersianDigits(salon.phone)}
                </a>
              )}
              <MapLinks lat={salon.latitude} lng={salon.longitude} address={`${salon.city} ${salon.address}`} />
            </div>
          </Section>
        </aside>
      </div>
    </div>
  );
}
