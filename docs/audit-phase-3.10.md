# Phase 3.10 audit — findings and resolution

Audit of the code, database and UI at commit `9d18ae6` before Phase 3.10. Every item below was fixed in this phase
unless marked *open*.

## Super Admin panel
| Finding | Resolution |
| --- | --- |
| Dashboard lacked today/completed/cancelled/services/tickets counts, charts and a date range | New dashboard with 13 live counters, 4 time-series charts + status breakdown, presets and custom range |
| Users: no detail page, sign-up-date/status filters, suspend/activate, last activity, pagination | Added (`/dashboard/admin/users/[id]`) with server-side protections |
| Any admin could grant the admin role | Only the super admin can grant/revoke `admin`; super admin cannot be changed/suspended |
| Salons: no detail page, no rejection reason, no edit history; owners never saw why | Detail page, reject with reason, owner alert + notification, edit-to-resubmit, field-level change log |
| Stylists: no detail page | Detail page with services, salons, portfolio, bookings, reviews, history |
| Bookings: only status/tracking filters, no detail, no admin actions in UI | Full filters, detail with status history, cancel/confirm/complete/no-show via booking rules |
| Categories were a DB enum — admins could not add one | Migration 0005: text key + FK; admins add/deactivate categories; usage counts |
| Reviews: hiding had no reason; reports stayed open | Hide/dismiss with reason, reports resolved automatically, ratings recomputed |
| Tickets: single internal note, no replies, users never saw answers | Reply / internal note / status history; users see replies under "پشتیبانی من" |
| No record of admin actions | Append-only `admin_audit_logs` + audit page and per-entity history |

## Staying signed in
| Finding | Resolution |
| --- | --- |
| Server Components refreshed the session in the DB but could not refresh the cookie → active users were logged out when the original cookie expired | RSC reads with `disableRefresh`; `SessionKeepAlive` refreshes DB + cookie together via `/api/auth/get-session` |
| 14-day lifetime | 30 days, rolling (renewed at most daily on activity) |
| Expired session → plain `/login` without context | `/login?next=…&notice=session_expired` |
| www vs bare-domain cookie not shared | Optional `AUTH_COOKIE_DOMAIN`; deployment checklist in `docs/auth.md` |
| No way to lock an account | Suspension: sessions deleted, sign-in blocked (2 layers) |

## Rest of the application
| Finding | Resolution |
| --- | --- |
| Notifications were written to the DB but never shown | Notifications page + unread badge on the dashboard bell |
| Signed-in users could not follow their support requests | "پشتیبانی من" page with history and new-request form |
| No error boundary outside the search pages | Root `error.tsx`, `global-error.tsx`, dashboard `error.tsx` |
| No navigation feedback in dashboards | Pending spinner on the clicked sidebar link; loading state on `/book` |
| Booking date step offered today after working hours (empty time list) | Days with no free time are shown as "تکمیل" and are not selectable |
| Search raw SQL still cast to the removed enum (caught by tests) | Fixed |

## Open / not possible without new infrastructure
* SMS / e-mail delivery (no provider configured): replies and notifications are in-app; guests are contacted manually.
* Online payment / subscriptions: plans are display-only; no financial data is invented.
* Map embed, multi-image salon gallery, persian date picker for admin date filters (native date inputs are Gregorian
  and labelled as such), distributed rate limiting (in-memory, single instance).
