# Reelshelf

A movie discovery app: sign up with WhatsApp OTP verification, sign in with email + password or phone + OTP, browse and search movies, and keep a personal shelf of saved movies.

- **Live URL:** _add after deploying_
- **Repository:** https://github.com/neerajgawane/reelshelf

## Architecture

One Next.js (App Router) project. The UI is React; the backend is Next.js route handlers under `src/app/api`. All secrets and third-party calls stay on the server.

```
src/
  app/
    api/auth/*          signup, verify-phone, login, OTP login, password reset, logout, me
    api/movies/*        IMDb236 proxy: browse, search, details
    api/saved-movies/*  per-user saved movies
    (auth)/             login, signup, verify-phone, forgot-password pages
    (app)/              discover, saved, movie/[id] (protected)
  lib/
    http.ts             route() wrapper: errors, validation failures, same-origin check
    validation.ts       zod schemas (email, password, E.164 phone, OTP code)
    otp.ts              issue / verify OTP challenges
    wapix.ts            WhatsApp delivery (server only)
    movies.ts           RapidAPI client, normalisation, cache, pagination
    session.ts, jwt.ts  httpOnly cookie sessions, reset tokens
    rateLimit.ts        Postgres-backed fixed-window rate limiter
    passwords.ts        bcrypt (cost 12)
  middleware.ts         redirects unauthenticated users away from protected pages
prisma/schema.prisma    User, SavedMovie, OtpChallenge, RateLimit
```

## Tech stack

Next.js 15, React 19, TypeScript, PostgreSQL (Neon), Prisma, zod, bcryptjs, jose (JWT), libphonenumber-js. Plain CSS, no UI framework.

## Authentication and OTP design

| Concern | Decision |
| --- | --- |
| Passwords | bcrypt, cost 12. Login runs a dummy bcrypt compare for unknown emails so timing doesn't reveal accounts. |
| Sessions | JWT (HS256) in an `httpOnly`, `SameSite=Lax`, `Secure` (prod) cookie, 7-day expiry. Every API call re-loads the user from the DB. |
| OTP generation | 6 digits from `crypto.randomInt` on the server. |
| OTP storage | Only `HMAC-SHA256(pepper, challengeId:code)` is stored, never the code. |
| Expiry / attempts | 5 minutes, max 5 attempts. The counter is incremented *before* comparing, so parallel guesses can't beat the limit. |
| Resend throttle | 30s cooldown per user+purpose, 5 sends/hour. A new code invalidates older open ones. |
| Rate limits | Per IP and per phone/email on signup, login, OTP request and OTP verify. Stored in Postgres so they hold across serverless instances. |
| Account enumeration | Login, OTP request/verify and password-reset endpoints return identical responses whether or not the account exists. Wrong, expired and locked codes all collapse to "invalid or expired" there. |
| OTP states | `pending` (code sent), `verified`, `expired`, `invalid` (plus `locked` on signup verification). |
| Password reset | Phone, then OTP, then a 10-minute signed reset token, then new password. Setting the password consumes the challenge atomically in a transaction, so it works once. |
| Account activation | Signup creates the user with `phoneVerified=false`. Login (any method) is refused until the OTP is verified. |
| CSRF | `SameSite=Lax` plus an Origin/Host check on every state-changing request. |

### API

```
POST   /api/auth/signup                  POST   /api/auth/request-password-reset
POST   /api/auth/resend-phone-otp        POST   /api/auth/verify-password-reset
POST   /api/auth/verify-phone            POST   /api/auth/reset-password
POST   /api/auth/login                   POST   /api/auth/logout
POST   /api/auth/request-login-otp       GET    /api/auth/me
POST   /api/auth/verify-login-otp
GET    /api/movies?page=                 GET    /api/saved-movies
GET    /api/movies/search?q=&page=       POST   /api/saved-movies
GET    /api/movies/:imdbId               DELETE /api/saved-movies/:imdbId
```

Errors are always `{ "error": { "code", "message", ... } }` with meaningful HTTP statuses (400, 401, 403, 409, 429, 502, 503).

## Environment variables

Copy `.env.example` to `.env` and fill in the values (names only here, never commit real values).

| Name | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection string (Neon: pooled) |
| `DIRECT_URL` | Direct Postgres connection string, used by migrations |
| `JWT_SECRET` | Signs session and reset tokens (32+ chars) |
| `OTP_PEPPER` | Keys the OTP HMAC (16+ chars) |
| `WAPIX_API_KEY` | Wapix secret key |
| `WAPIX_BASE_URL` | Defaults to `https://api.wapix.sbs/api/v1` |
| `RAPIDAPI_KEY` | RapidAPI key with an IMDb236 subscription |
| `RAPIDAPI_HOST` | Defaults to `imdb236.p.rapidapi.com` |
| `IMDB_BROWSE_PATH` | List shown on Discover. Defaults to `/most-popular-movies` |
| `OTP_DEV_LOG` | `true` prints OTPs to the server console instead of sending (ignored in production) |

## Wapix setup

1. Create an account at wapix.sbs and top up the wallet (minimum ₹50; an OTP costs ₹0.25).
2. In the dashboard, start a session and scan the QR code via WhatsApp > Linked Devices.
3. Generate an API key (API Keys tab) and set it as `WAPIX_API_KEY`.

The backend calls `POST {WAPIX_BASE_URL}/send/otp` with `service`, `whatsaap_number` (digits only, no `+`; the spelling is Wapix's), `otp`, `text` and `api_key`. The key never reaches the browser. If delivery fails, signup returns 502 and the challenge is discarded.

## Movie API (RapidAPI) setup

Subscribe to the **IMDb236** API on RapidAPI and set `RAPIDAPI_KEY`. All provider-specific code (endpoints, params, response mapping) is isolated in `src/lib/movies.ts`. Browse uses a list endpoint and search uses `/search?type=movie&primaryTitle=...`; results are normalised to `{ id, title, poster, year, rating }`, cached in memory (5-10 min) with in-flight de-duplication to protect the free-tier quota, and paginated server-side (12 per page). If the provider's response shape differs from what `normalize()` expects, adjust it there.

## Database setup

```bash
npx prisma migrate dev --name init   # local: creates and applies the migration (commit prisma/migrations)
npx prisma migrate deploy            # production
```

Constraints worth knowing: `User.email` and `User.phone` are unique; `SavedMovie` has a unique `(userId, externalMovieId)`, so duplicate saves are impossible; saved movies and OTP challenges cascade-delete with the user.

## Run locally

```bash
npm install
cp .env.example .env     # fill in values; set OTP_DEV_LOG=true to skip Wapix locally
npx prisma migrate dev --name init
npm run dev              # http://localhost:3000
```

## Deploy (Vercel + Neon)

1. Create a Neon project; copy the pooled string to `DATABASE_URL` and the direct string to `DIRECT_URL`.
2. Run `npx prisma migrate deploy` once against the Neon database.
3. Import the GitHub repo into Vercel and add every variable above (leave `OTP_DEV_LOG` unset).
4. Deploy. `npm run build` runs `prisma generate` automatically.

## Frontend behaviour

- **Debounced search:** input is committed 400 ms after the user stops typing; a new query resets to page 1. Each request is aborted when a newer one starts, so stale responses can't overwrite fresh ones.
- **Pagination keeps state:** query and page live in the URL (`/discover?q=...&page=2`), so refresh and back/forward restore them.
- **Save/unsave** is optimistic and rolls back with an error message if the server rejects it.
- Skeleton loaders, empty states, error states with retry, and responsive layouts down to mobile.

## Known limitations and trade-offs

- Signup reveals when an email/phone is already registered (it has to, to be usable). Other auth endpoints don't.
- Email addresses are not verified; only phone ownership is.
- Sessions are a single 7-day JWT with no server-side revocation or refresh rotation. Logout clears the cookie.
- The movie cache is per server instance. A shared cache (Redis) would be the next step at scale.
- Search fetches up to 50 results from the provider and paginates them server-side, because the provider's cursor pagination doesn't map to page numbers.
- No automated tests yet; the OTP and saved-movie routes are the first candidates.
