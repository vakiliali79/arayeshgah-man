# ArayeshgahMan — Dashboards, public pages, search and booking (Phase 3)

All role and ownership checks run **on the server** (`requireSession(roles)` in layouts *and* pages, plus
`assertSalonPermission` / ownership checks inside every service function). The UI never decides access.

## Routes

| Area | Routes | Access |
| --- | --- | --- |
| Public | `/`, `/salons`, `/salons/[slug]`, `/stylists`, `/stylists/[slug]`, `/book` | everyone (only *public* salons/stylists, see below) |
| Content | `/about`, `/contact`, `/careers`, `/businesses`, `/register-salon`, `/join-as-stylist`, `/pricing`, `/support`, `/faq`, `/terms`, `/privacy` | everyone |
| Auth | `/login`, `/register` | guests |
| Dashboard entry | `/dashboard` → redirects to the user's own dashboard | signed in |
| Customer | `/dashboard/customer`, `…/bookings`, `…/bookings/[id]`, `…/favorites`, `…/reviews`, `…/profile` | any signed-in user, own data only |
| Stylist | `/dashboard/stylist`, `…/bookings`, `…/services`, `…/schedule`, `…/portfolio`, `…/reviews`, `…/salons`, `…/profile` | role `stylist` |
| Salon | `/dashboard/salon`, `/dashboard/salon/[salonId]` + `bookings`, `services`, `team`, `schedule`, `reviews`, `settings` | owner, admin, or a member with salon permissions; other salons → 404 |
| Admin | `/dashboard/admin` + `users`, `salons`, `stylists`, `bookings`, `reviews`, `tickets`, `categories`, `plans`, `content` | role `admin` |
| API | `/api/auth/[...all]` (Better Auth), `/api/files/[id]` (public images only) | — |
| SEO | `/sitemap.xml`, `/robots.txt`, Open Graph image, JSON-LD on detail pages | — |

**Public visibility** (`src/server/public/visibility.ts`): a salon is public when `is_active AND is_verified`
(new salons need admin approval); a stylist is public when active and either accepts independent bookings or is an
active stylist member of a public salon. Anything else returns a real HTTP 404.

## Search (`/salons`, `/stylists`)

GET form (works without JavaScript), all filters validated with zod (`src/server/public/search.ts`; invalid values
fall back to defaults): text, city, district, service category, specialty (stylists), price range, minimum rating,
"has a free time in the next 7 days", sort (popular / rating / cheapest / most expensive), 12 per page.

## Booking

1. `/book?salon=…|stylist=…` → service → stylist (auto-selected if only one) → date (next 14 days, closed days
   disabled) → free times → confirm. Each step is a link; the state lives in the URL and is **re-validated against the
   DB on every request** (`src/server/public/booking-flow.ts`).
2. Free times (`src/server/public/slots.ts`) come from one SQL query: stylist shift ∩ salon hours, minus active
   bookings incl. buffer, time off/closures, minimum lead time, and the signed-in customer's own overlapping bookings.
   A property test checks that a time is offered **iff** `createBooking` accepts it.
3. Guests are asked to sign in at the confirm step and come back to the same step.
4. `createBookingAction` reads only ids + local date/time; timezone, price and duration come from the DB.
   `createBooking` re-checks everything in a transaction (past/too-soon, max advance, working hours, salon hours,
   time off, membership, overlaps). PostgreSQL exclusion constraints make double booking impossible even under
   concurrency. On success → `/dashboard/customer/bookings/[id]?created=1` with the tracking code (`AM-XXXXXXXXXX`).
   If the time was taken meanwhile, the user sees the error and a "choose another time" link.
5. New bookings are `pending`; the stylist/salon confirms, completes or cancels; customers may cancel up to 2 hours
   before; reviews are possible only for completed bookings (one per booking).

## Migration 0004 (`drizzle/0004_phase3_marketplace.sql`)

* enums `ticket_kind`, `ticket_status`, `plan_audience`; `membership_status` gains `requested`
* tables `service_categories` (8 seeded categories), `site_settings`, `subscription_plans`, `support_tickets`
* `bookings.tracking_code` (existing rows backfilled from their id, then `NOT NULL UNIQUE`)
* `salons.district`, `stylists.slug` (existing rows backfilled `stylist-…`, unique + format check), `stylists.city`,
  `stylists.district`; `updated_at` triggers for the new tables
* No data is deleted. Rollback: `drizzle/rollback/0004_phase3_marketplace.down.sql` (tested: migrate → rollback →
  migrate on a copy of the dev data, data checksums identical).

## Manual test guide (local, seeded DB, code `1111`)

Start: `npm run db:migrate && npm run db:seed && npm run dev` (seed only on a local DB). Sign in at `/login`.

| Role | Number | What to check |
| --- | --- | --- |
| Customer | `09350000001` (Mina) | `/salons` filters & sort → open a salon → "رزرو این خدمت" → pick day/time → confirm → receipt with tracking code; see it under "نوبت‌ها"; cancel it; add/remove favorite; report a review; try `/dashboard/admin` → sent back to the customer dashboard |
| Stylist | `09130000001` (Negar) | pending booking from the customer appears → confirm; edit services/prices, weekly schedule and time off (times disappear from `/book`); upload portfolio; reply to a review; membership requests in "سالن‌ها" |
| Salon owner | `09120000001` (Rose Gold) | salon bookings (confirm/cancel), services and stylist assignment, team invite by phone & permissions, salon hours/closures, settings & cover, reports; open another salon id in the URL → 404 |
| Admin | `09120000099` | users & roles (the super admin `09991797982` cannot be demoted), approve/suspend salons (unapproved salons vanish from public pages), stylists, all bookings, hide reviews / handle reports, tickets from `/contact` & `/support`, categories, plans, site content (about/contact/careers/announcement) |
| Guest | — | `/contact` and `/support` forms (validation + success message), `/register-salon` / `/join-as-stylist` → registration with the right account type, unknown `/salons/xyz` → 404 |

With `AUTH_TEST_MODE=true` any number signs in with `1111` and `09991797982` is always admin (see `docs/auth.md`).

## Tests

* `npm test` — 187 integration tests on a real PostgreSQL test DB (dashboards for all roles, permissions, search,
  slot engine incl. the consistency property test, booking flow, detail pages, migrations).
* `npm run build && npm run test:e2e` — 21 browser tests on the production build: OTP auth, full booking
  (guest → login → confirm → receipt, taken slot, stale form rejected by the server), access matrix for all four roles
  (+ guest), cross-user/cross-salon isolation, and a crawl that fails on any broken internal link.
