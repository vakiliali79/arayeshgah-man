# ArayeshgahMan — Authentication (Better Auth 1.7, mobile number + OTP)

Sign-up and sign-in use **only an Iranian mobile number and a 4-digit one-time code**, built on the
official Better Auth `phoneNumber` plugin. Email/password, email verification, password reset and all
mail sending (Resend) have been removed.

## Architecture

```
Browser ── Server Actions (src/features/auth/actions.ts) ─► phone-auth service ─► auth.api.* ─┐
   │        zod validation · app rate limit (per IP + per number) · Persian messages          │
   │                                                                                          ▼
   └──── /api/auth/[...all] (toNextJsHandler) ───────────────────────────────────► Better Auth + phoneNumber plugin
              Better Auth rate limit · origin checks · "before" middleware                   │
                                                                                             ▼
                                                    PostgreSQL: users(phone_number, …) · sessions · verifications
                                                                profiles(role)  ← app-owned
proxy.ts        optimistic cookie check for /dashboard/* → /login?next=…
requireSession  real validation (session row + profile role) in every protected page/action
```

| Piece | File |
| --- | --- |
| Better Auth config (plugin, hooks, cookies, rate limits, disabled paths) | `src/server/auth/better-auth.ts` |
| Login / registration flow (request code, verify, create account, apply role) | `src/server/auth/phone-auth.ts` |
| OTP config (`static` / `sms`), production rules | `src/server/otp/config.ts` |
| OTP sender interface (SMS providers plug in here) | `src/server/otp/sender.ts` |
| Phone normalization (`+989XXXXXXXXX`) | `src/server/otp/phone.ts` |
| Request-scoped registration intent | `src/server/otp/intent.ts` |
| Session + role resolution | `src/server/auth/session.ts`, `src/server/auth/current.ts` |
| Server actions | `src/features/auth/actions.ts` |
| UI: two-step forms, 4-box code input | `src/features/auth/components/*` |

## Flows

**Register** (`/register`): name, account type (customer / stylist / salon_owner — never admin), mobile, terms
→ `requestOtp(register)` refuses numbers that already have an account → code step (number shown, "edit number",
resend after 60 s) → `verifyRegistrationOtp` verifies the code inside a *registration intent*; Better Auth creates
the user (`phone_number` verified) and a session; the `user.create.after` hook creates a `customer` profile;
the chosen role and contact phone are then applied server-side, once → `/dashboard?welcome=registered`.

**Login** (`/login`): mobile → `requestOtp(login)` refuses unknown numbers ("no account — register first")
→ code → `verifyLoginOtp` → session → `next` or `/dashboard?welcome=login`.

**Logout**: `signOut` deletes the session row and clears the cookie.

## Security properties

* **One account per number.** Numbers are normalized (`09…`, `9…`, `+98…`, `0098…`, Persian/Arabic digits, spaces,
  dashes → `+989XXXXXXXXX`). Better Auth's `phoneNumberValidator` accepts only that canonical form, and the DB has
  `UNIQUE(phone_number)` plus a format `CHECK`.
* **Codes:** 4 digits, valid 5 minutes, single-use, **bound to the number they were requested for**, max 3 wrong
  attempts per code (then a new code is required). Codes are never returned by the API or written to logs.
* **No account creation outside registration.** A Better Auth `before` middleware rejects `/phone-number/verify` for
  unknown numbers (`ACCOUNT_NOT_FOUND`) unless the call runs inside the app's registration flow; a
  `user.create.before` hook blocks creation as a second layer. Changing the phone number via the API is disabled.
* **Roles** live only in `profiles.role` and are read from the DB on every request. Public registration validates the
  role against `customer | stylist | salon_owner`; admins are created only with `npm run db:create-admin`.
* **Disabled endpoints:** email sign-up/sign-in, email verification, password reset (email and phone), password
  sign-in by phone, `update-user`, `change-email`, `delete-user`, `change-password`, `set-password`.
* **Rate limits:** Better Auth (HTTP, production): send-otp 3/min, verify 10/min per IP. Server actions (all
  environments): code requests 5 per number and 20 per IP per 10 min; verification 10 per number and 30 per IP per
  10 min (looser per IP because mobile carriers share IPs). The app limiter is in-memory (single instance).
* **Session cookie** `arayeshgah.session_token`: `HttpOnly`, `SameSite=Lax`, `Path=/`; production adds `Secure` and the
  `__Secure-` prefix. Sessions are stored in PostgreSQL (14 days, refreshed daily).

## OTP modes

| `AUTH_OTP_MODE` | Code | SMS sent | Allowed in production |
| --- | --- | --- | --- |
| `static` (dev default) | `AUTH_STATIC_OTP` (default `1111` outside production) | no | **No** — unless explicitly enabled, see below |
| `sms` | random (Better Auth) | via `SMS_PROVIDER` | yes (once a provider is implemented) |

In production `AUTH_OTP_MODE` has no default; the app refuses to start with a missing/invalid OTP configuration.

### Controlled test mode on a private VPS (static code in production)

Only for a non-public test deployment. All of the following are required:

```
AUTH_OTP_MODE=static
AUTH_STATIC_OTP=1111                       # no default in production
AUTH_STATIC_OTP_ALLOW_IN_PRODUCTION=1
AUTH_STATIC_OTP_ALLOWED_IPS=203.0.113.7    # comma-separated; your office/VPN IPs
```

OTP requests from any other IP get `403 OTP_NOT_AVAILABLE` (shown as "not available"). The client IP is read
**only from `X-Real-IP`**, so nginx **must overwrite it** (never pass a client-supplied value):

```nginx
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $remote_addr;
```

Defense in depth: also restrict the whole test vhost in nginx (`allow 203.0.113.7; deny all;`) or with HTTP basic auth.

### Adding a real SMS provider (e.g. Kavenegar, Melipayamak)

1. Implement `OtpSender` in `src/server/otp/` (e.g. `kavenegar.ts`): `send({ phoneNumber, code })` calls the
   provider's verify/lookup API with an approved template; never log the code; throw on failure.
2. Add the provider id to `SMS_PROVIDERS` in `src/server/otp/config.ts` and construct it in `createOtpSender`
   (read its API key from a server-only env var, e.g. `KAVENEGAR_API_KEY`).
3. Set `AUTH_OTP_MODE=sms`, `SMS_PROVIDER=kavenegar` (+ its key) and remove the static-mode variables.

No auth logic changes: Better Auth keeps generating, storing, expiring and checking the code.

## Data

* `users.phone_number` (unique, `+989XXXXXXXXX`) and `users.phone_number_verified` were added by migration 0002.
* Migration 0003 copied existing `profiles.phone` values into `users.phone_number`, so existing users can sign in
  with OTP; the first successful OTP login marks the number verified.
* `users.email` is **kept** (existing emails untouched). It is mandatory in Better Auth's core user model, so new
  phone-only users get a non-routable placeholder `…@phone.arayeshgahman.invalid`. Email is no longer used for auth.
* Rollback: `drizzle/rollback/0002_0003_phone_auth.down.sql` (see header for usage).

## Environment variables

`DATABASE_URL`, `BETTER_AUTH_SECRET` (≥ 32 chars in production), `BETTER_AUTH_URL`, `AUTH_OTP_MODE`,
`AUTH_STATIC_OTP`, `AUTH_STATIC_OTP_ALLOW_IN_PRODUCTION`, `AUTH_STATIC_OTP_ALLOWED_IPS`, `SMS_PROVIDER` (future),
`NEXT_PUBLIC_SITE_URL`, `UPLOAD_DIR`, `UPLOAD_MAX_BYTES`; tests: `DATABASE_URL_TEST` (in `.env.test.local`).

## Tests

```bash
npm test                              # unit + integration (Vitest, real PostgreSQL test DB)
npm run build && npm run test:e2e     # production build + Chromium, controlled static-OTP mode with IP allow-list
```
