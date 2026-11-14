import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { CalendarIcon, MapPinIcon, StoreIcon } from "@/components/icons";
import { Avatar, Badge, buttonVariants, EmptyState, Rating } from "@/components/ui";
import { siteConfig } from "@/config/site";
import { db } from "@/db";
import { SalonCard } from "@/features/public/components/cards";
import { AvailabilityList, FavoriteButton, JsonLd, OfferingsList, PortfolioGrid, ReviewsList, Section, WeeklyHours } from "@/features/public/components/detail";
import { bookHref } from "@/lib/booking-links";
import { fileUrl } from "@/lib/files";
import { pageMetadata } from "@/lib/seo";
import { toPersianDigits } from "@/lib/utils";
import { getCurrentSession } from "@/server/auth/current";
import { isFavorite } from "@/server/favorites/service";
import { getPublicStylist } from "@/server/public/details";
import { currentTime } from "@/server/time";

const load = cache((slug: string) => getPublicStylist(db, slug, currentTime()));

export async function generateMetadata({ params }: PageProps<"/stylists/[slug]">): Promise<Metadata> {
  const data = await load((await params).slug);
  if (!data) return { title: "آرایشگر پیدا نشد", robots: { index: false } };
  const { stylist } = data;
  const description = (stylist.bio ?? `${stylist.displayName}${stylist.specialties.length ? `، ${stylist.specialties.join("، ")}` : ""} — خدمات، نمونه‌کار، نظرات و رزرو آنلاین.`).slice(0, 160);
  const meta = pageMetadata(stylist.displayName, description, `/stylists/${stylist.slug}`);
  const avatar = fileUrl(data.avatarFileId);
  if (avatar) {
    meta.openGraph = { ...meta.openGraph, images: [{ url: avatar }] };
    meta.twitter = { ...meta.twitter, card: "summary", images: [avatar] };
  }
  return meta;
}

export default async function StylistPage({ params }: PageProps<"/stylists/[slug]">) {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) notFound();
  const { stylist, avatarFileId, offerings, salons, hours, portfolio, reviews, availability } = data;
  const session = await getCurrentSession();
  const favorited = session ? await isFavorite(db, session.user.id, { stylistId: stylist.id }) : false;
  const path = `/stylists/${stylist.slug}`;
  const avatar = fileUrl(avatarFileId);
  const independent = stylist.acceptsIndependentBookings;
  const location = [stylist.city, stylist.district].filter(Boolean).join("، ");
  const hourGroups = [
    ...salons.map((s) => ({ key: s.id, title: s.name, hours: hours.filter((h) => h.salonId === s.id) })),
    ...(independent ? [{ key: "independent", title: "نوبت مستقل", hours: hours.filter((h) => !h.salonId) }] : []),
  ];

  return (
    <div className="container-page space-y-6 py-6 sm:py-10">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Person",
          name: stylist.displayName,
          jobTitle: "آرایشگر",
          url: `${siteConfig.url.replace(/\/$/, "")}${path}`,
          ...(stylist.specialties.length ? { knowsAbout: stylist.specialties } : {}),
          ...(salons.length ? { worksFor: salons.map((s) => ({ "@type": "BeautySalon", name: s.name })) } : {}),
        }}
      />
      <nav aria-label="مسیر" className="text-xs text-muted">
        <Link href="/" className="hover:underline">خانه</Link> / <Link href="/stylists" className="hover:underline">آرایشگران</Link> / <span>{stylist.displayName}</span>
      </nav>

      <header className="flex flex-col gap-5 rounded-lg border border-border bg-surface p-5 sm:flex-row sm:items-center sm:p-6">
        {avatar ? (
          <Image src={avatar} alt={stylist.displayName} width={112} height={112} unoptimized priority className="size-24 rounded-full object-cover sm:size-28" />
        ) : (
          <Avatar name={stylist.displayName} className="size-24 text-2xl sm:size-28" />
        )}
        <div className="min-w-0 flex-1 space-y-2">
          <h1 className="text-2xl font-extrabold sm:text-3xl">{stylist.displayName}</h1>
          {stylist.specialties.length > 0 && <p className="text-sm text-muted">{stylist.specialties.join("، ")}</p>}
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
            {stylist.ratingCount > 0 ? <Rating value={stylist.ratingAvg} count={stylist.ratingCount} /> : <span>هنوز نظری ثبت نشده</span>}
            {stylist.yearsExperience ? <span>{toPersianDigits(stylist.yearsExperience)} سال سابقه</span> : null}
            {independent && location && <span className="inline-flex items-center gap-1"><MapPinIcon size={16} /> {location}</span>}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {independent && <Badge tone="gold">نوبت مستقل</Badge>}
            {salons.map((s) => <Link key={s.id} href={`/salons/${s.slug}`}><Badge tone="neutral"><StoreIcon size={12} /> {s.name}</Badge></Link>)}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <FavoriteButton loggedIn={!!session} favorited={favorited} target={{ stylistId: stylist.id }} returnTo={path} />
          {offerings.length > 0 && <Link href={bookHref({ stylist: stylist.slug })} className={buttonVariants({ size: "md" })}><CalendarIcon size={18} /> رزرو نوبت</Link>}
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="min-w-0 space-y-6">
          {stylist.bio && <Section id="about" title="درباره من"><p className="leading-8 whitespace-pre-line">{stylist.bio}</p></Section>}
          <Section id="services" title="خدمات و قیمت‌ها"><OfferingsList offerings={offerings} groupBy="location" showSalon /></Section>
          <Section id="availability" title="نزدیک‌ترین زمان‌های آزاد"><AvailabilityList items={availability} /></Section>
          <Section id="salons" title="سالن‌های محل فعالیت">
            {salons.length === 0 ? (
              <EmptyState icon={<StoreIcon />} title={independent ? "فقط به‌صورت مستقل نوبت می‌پذیرد" : "عضو سالنی نیست"} className="py-8" />
            ) : (
              <ul className="grid gap-4 sm:grid-cols-2">{salons.map((s) => <li key={s.id}><SalonCard s={s} /></li>)}</ul>
            )}
          </Section>
          <Section id="portfolio" title="نمونه‌کارها"><PortfolioGrid items={portfolio} /></Section>
          <Section id="reviews" title={`نظرات مشتریان${reviews.length ? ` (${toPersianDigits(reviews.length)})` : ""}`}>
            <ReviewsList reviews={reviews} loggedIn={!!session} returnTo={path} />
          </Section>
        </div>
        <aside className="space-y-6 lg:sticky lg:top-24 lg:h-fit">
          {hourGroups.length === 0 ? (
            <Section title="ساعات کاری"><WeeklyHours hours={[]} /></Section>
          ) : (
            hourGroups.map((g) => <Section key={g.key} title={`ساعات کاری — ${g.title}`}><WeeklyHours hours={g.hours} /></Section>)
          )}
        </aside>
      </div>
    </div>
  );
}
