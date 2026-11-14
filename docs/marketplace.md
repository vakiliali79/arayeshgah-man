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
| Customer ("حساب من") | `/dashboard/customer`, `…/bookings`, `…/bookings/[id]`, `…/favorites`, `…/reviews`, `…/notifications`, `…/support`, `…/profile` | any signed-in user, own data only |
| Stylist | `/dashboard/stylist`, `…/bookings`, `…/services`, `…/schedule`, `…/portfolio`, `…/reviews`, `…/salons`, `…/profile` | role `stylist` |
| Salon | `/dashboard/salon`, `/dashboard/salon/[salonId]` + `bookings`, `services`, `team`, `schedule`, `reviews`, `settings` | owner, admin, or a member with salon permissions; other salons → 404 |
| Admin | `/dashboard/admin` + `users`, `users/[id]`, `salons`, `salons/[id]`, `stylists`, `stylists/[id]`, `bookings`, `bookings/[id]`, `reviews`, `tickets`, `tickets/[id]`, `categories`, `plans`, `content`, `audit` | role `admin` (layout **and** every page **and** every service function) |
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

## Super Admin panel (Phase 3.10)

All numbers and lists come from the same tables the other roles use; nothing is mocked.

* **Dashboard** — users by role, salons (registered / approved / pending / rejected / inactive), bookings (total, today,
  pending, completed, cancelled), services, support tickets; charts for user growth, salon registrations, bookings,
  active users (booked, reviewed or opened a ticket) and status breakdown, for 7/30/90/365 days or a custom range
  (daily ≤ 62 days, otherwise weekly from Saturday). Each chart has a data-table view.
* **Users** — search by name/mobile, filter by role, account status and sign-up date, pagination; detail page with
  account status, last recorded activity, active sessions, owned salons, salon memberships, stylist profile, bookings
  and admin history. Role change and suspend/activate (reason required) are checked on the server:
  the super admin `09991797982` can never be changed or suspended, admins cannot change themselves, and only the super
  admin can grant or revoke the `admin` role. Suspension ends all sessions at once, blocks sign-in and hides the stylist
  profile; re-activation restores only what the suspension changed.
* **Salons** — tabs pending / approved / rejected / inactive with counts; detail page with owner, members, services,
  bookings and history; approve, reject with reason (owner sees it and is notified; editing the salon resubmits it),
  revoke approval, deactivate/activate (reason), edit details (reason + field-level change log, owner notified).
* **Stylists** — search/filter; detail page with specialties, services, salons, portfolio, bookings, reviews, history;
  activate/deactivate.
* **Bookings** — search by tracking code or customer name/mobile; filter by status, salon, stylist, customer, date
  range; detail page with status history; cancel (reason required), confirm, complete, no-show — all through the
  booking state machine and its time rules. Rescheduling is intentionally not offered (it would bypass the overlap
  checks); the customer books a new time.
* **Categories** — add (latin key), rename, order, activate/deactivate; usage counts. A category in use cannot be
  deleted (foreign key) — deactivate it instead; inactive categories cannot be chosen for new services.
* **Reviews** — filter by rating, reported / hidden / all; report texts shown inline; hide (reason, reports resolved,
  ratings recomputed), show again, dismiss reports (reason).
* **Support** — tabs by status with counts, kind filter, search; detail page with sender info, reply (visible to the
  signed-in user under "پشتیبانی من" + notification), internal note (admins only), status change with note — full
  follow-up history. Email/SMS delivery is not configured, so guests are contacted by the phone/email they left.
* **Plans & content** — unchanged features, now audited. No payment or financial data exists (none is invented).
* **Audit log** (`/dashboard/admin/audit`) — every admin action: who, when, target, reason and field changes. A
  database trigger makes the table append-only (no edits, no deletes).

Users also gained **notifications** (`/dashboard/customer/notifications`, unread badge on the bell in the dashboard
header) for booking changes, new reviews, salon decisions and support replies.

## Migration 0005 (`drizzle/0005_phase3_10_admin.sql`)

* tables `admin_audit_logs` (append-only trigger) and `support_ticket_messages`; enums `account_status`,
  `ticket_message_kind`
* `profiles.status / suspended_at / suspended_reason`, `salons.rejection_reason / reviewed_at`, `reviews.hidden_reason`
* `services.category` and `service_categories.key`: enum → text (values unchanged) + foreign key + key format check;
  the old `service_category` enum is dropped
* No data is deleted. Rollback: `drizzle/rollback/0005_phase3_10_admin.down.sql`. Tested on a copy of the dev data:
  migrate → rollback → migrate with identical data checksums.

## Migration 0004 (`drizzle/0004_phase3_marketplace.sql`)

* enums `ticket_kind`, `ticket_status`, `plan_audience`; `membership_status` gains `requested`
* tables `service_categories` (8 seeded categories), `site_settings`, `subscription_plans`, `support_tickets`
* `bookings.tracking_code` (existing rows backfilled from their id, then `NOT NULL UNIQUE`)
* `salons.district`, `stylists.slug` (existing rows backfilled `stylist-…`, unique + format check), `stylists.city`,
  `stylists.district`; `updated_at` triggers for the new tables
* No data is deleted. Rollback: `drizzle/rollback/0004_phase3_marketplace.down.sql` (tested: migrate → rollback →
  migrate on a copy of the dev data, data checksums identical).

## Manual test guide (local, seeded DB, code `1111`)

Start: `npm run db:migrate && npm run db:seed && npm run dev` (seed only on a local DB). Sign in at `/login`. Sign-in persists: close the browser, reopen the site — you are still signed in until "خروج از حساب".

| Role | Number | What to check |
| --- | --- | --- |
| Customer | `09350000001` (Mina) | `/salons` filters & sort → open a salon → "رزرو این خدمت" → pick day/time → confirm → receipt with tracking code; see it under "نوبت‌ها"; cancel it; add/remove favorite; report a review; try `/dashboard/admin` → sent back to the customer dashboard |
| Stylist | `09130000001` (Negar) | pending booking from the customer appears → confirm; edit services/prices, weekly schedule and time off (times disappear from `/book`); upload portfolio; reply to a review; membership requests in "سالن‌ها" |
| Salon owner | `09120000001` (Rose Gold) | salon bookings (confirm/cancel), services and stylist assignment, team invite by phone & permissions, salon hours/closures, settings & cover, reports; open another salon id in the URL → 404 |
| Admin | `09120000099` | dashboard range filter & charts; users: filter, open a user, change role, suspend (that user is signed out and cannot sign in) and re-activate; salons: register a new one as an owner → reject it with a reason → owner sees the reason → owner edits → approve → it appears in `/salons`; bookings: search by tracking code, cancel with reason; reviews: hide with reason / dismiss reports; support: reply to a ticket (visible to the user under "پشتیبانی من"); categories: add one and use it in a service; audit log shows all of the above. The super admin `09991797982` cannot be demoted or suspended. |
| Guest | — | `/contact` and `/support` forms (validation + success message), `/register-salon` / `/join-as-stylist` → registration with the right account type, unknown `/salons/xyz` → 404 |

With `AUTH_TEST_MODE=true` any number signs in with `1111` and `09991797982` is always admin (see `docs/auth.md`).

## Tests

* `npm test` — 206 integration tests on a real PostgreSQL test DB (dashboards for all roles, permissions, search,
  slot engine incl. the consistency property test, booking flow, detail pages, migrations, admin panel incl. audit
  log immutability, persistent sessions, cross-role data integrity).
* `npm run build && npm run test:e2e` — 25 browser tests on the production build: OTP auth, full booking
  (guest → login → confirm → receipt, taken slot, stale form rejected by the server), access matrix for all four roles
  (+ guest), cross-user/cross-salon isolation, a crawl that fails on any broken internal link, sign-in surviving a
  browser restart / refresh / logout, admin rejecting a salon and suspending a user through the UI.
