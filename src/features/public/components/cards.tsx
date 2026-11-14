import Image from "next/image";
import Link from "next/link";
import { MapPinIcon, ScissorsIcon } from "@/components/icons";
import { Avatar, Badge, Rating } from "@/components/ui";
import { fileUrl } from "@/lib/files";
import { formatToman, toPersianDigits } from "@/lib/utils";

export interface SalonCardData {
  id: string;
  name: string;
  slug: string;
  city: string;
  district: string | null;
  ratingAvg: number;
  ratingCount: number;
  coverFileId: string | null;
  categories?: string[];
  minPrice?: number | null;
  hasAvailability?: boolean;
}

/** کارت سالن (تصویر کاور واقعی یا پس‌زمینه برند در صورت نبود تصویر) */
export function SalonCard({ s }: { s: SalonCardData }) {
  const cover = fileUrl(s.coverFileId);
  return (
    <article className="group h-full overflow-hidden rounded-lg border border-border bg-surface transition-shadow hover:shadow-lift">
      <Link href={`/salons/${s.slug}`} className="block">
        <div className="relative aspect-[4/3] bg-gradient-to-br from-primary-200 to-gold-100">
          {cover ? (
            <Image src={cover} alt={s.name} fill unoptimized sizes="(max-width: 640px) 80vw, 25vw" className="object-cover" />
          ) : (
            <span className="absolute inset-0 flex items-center justify-center text-4xl font-black text-primary-700/30">{s.name.slice(0, 1)}</span>
          )}
          {s.hasAvailability && <span className="absolute top-3 start-3 rounded-full bg-surface/90 px-2.5 py-1 text-xs font-medium backdrop-blur">نوبت آزاد در ۷ روز آینده</span>}
        </div>
        <div className="space-y-2.5 p-4">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-bold leading-7">{s.name}</h3>
            {s.ratingCount > 0 ? <Rating value={s.ratingAvg} count={s.ratingCount} /> : <span className="text-xs text-muted">بدون نظر</span>}
          </div>
          <p className="flex items-center gap-1.5 text-xs text-muted"><MapPinIcon size={14} /> {s.city}{s.district ? `، ${s.district}` : ""}</p>
          <div className="flex flex-wrap items-center gap-1.5">
            {(s.categories ?? []).slice(0, 3).map((c) => <Badge key={c} tone="neutral">{c}</Badge>)}
            {s.minPrice ? <span className="ms-auto text-xs text-muted">از {formatToman(s.minPrice)}</span> : null}
          </div>
        </div>
      </Link>
    </article>
  );
}

export interface StylistCardData {
  id: string;
  name: string;
  slug: string;
  specialties: string[];
  ratingAvg: number;
  ratingCount: number;
  avatarFileId?: string | null;
  salonNames?: string[];
  independent?: boolean;
  city?: string | null;
  minPrice?: number | null;
}

export function StylistCard({ s }: { s: StylistCardData }) {
  const avatar = fileUrl(s.avatarFileId);
  return (
    <article className="h-full rounded-lg border border-border bg-surface p-5 transition-shadow hover:shadow-lift">
      <Link href={`/stylists/${s.slug}`} className="flex h-full flex-col items-center gap-3 text-center">
        {avatar ? <Image src={avatar} alt={s.name} width={64} height={64} unoptimized className="size-16 rounded-full object-cover" /> : <Avatar name={s.name} className="size-16 text-lg" />}
        <div>
          <h3 className="font-bold">{s.name}</h3>
          <p className="text-xs text-muted">{s.specialties.slice(0, 3).join("، ") || "آرایشگر"}</p>
        </div>
        <div className="flex flex-wrap justify-center gap-1.5 text-xs">
          {s.independent && <Badge tone="gold">نوبت مستقل</Badge>}
          {(s.salonNames ?? []).slice(0, 2).map((n) => <Badge key={n} tone="neutral"><ScissorsIcon size={12} /> {n}</Badge>)}
        </div>
        <div className="mt-auto flex items-center gap-3 text-xs text-muted">
          {s.ratingCount > 0 ? <Rating value={s.ratingAvg} count={s.ratingCount} /> : <span>بدون نظر</span>}
          {s.minPrice ? <span>از {formatToman(s.minPrice)}</span> : null}
          {s.city && <span>{s.city}</span>}
        </div>
      </Link>
    </article>
  );
}

export const n = (v: number) => toPersianDigits(v.toLocaleString("en-US"));
