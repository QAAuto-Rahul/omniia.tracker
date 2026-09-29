# Omniia Tracker

Internal SDLC Corp portal. Sign-in is by emailed one-time code and is restricted to `@sdlccorp.com` accounts.

## Modules

### EnvPack

Environment variables for every service, organised by environment.

- **Environment dropdown** (top right) picks the environment: Development, QA, Staging, Production and so on. Switching it keeps you on the same page. On a service, you see that service's values in the newly selected environment. The last environment you used is remembered.
- **Services are shared by all environments.** Add a service once and it appears in every environment, and each environment keeps its own values. Deleting a service removes it from every environment.
- **Variables** per service per environment: add, edit inline, delete, copy. Values are always shown in plain text.
- **Copy from another environment**: fill a service's keys (optionally with values) from another environment. Existing keys are kept.
- **New environment** can copy all keys (optionally with values) from an existing environment. Deleting an environment requires typing its name.
- **Import / export**: paste a `.env` file to bulk add or update; copy or download as `.env`.
- Colour-coded environments (production is red) and "last updated by" on every value.

## Stack

Next.js 16 (App Router, Server Actions) · Tailwind CSS 4 · shadcn/ui (Base UI) · MongoDB (values encrypted with AES-256-GCM) · `jose` sessions · `nodemailer`.

Requires **Node 22.13+** (tested on Node 25).

## Getting started

```bash
npm install
cp .env.example .env.local   # then set SESSION_SECRET
npm run dev
```

Open <http://localhost:3000> and sign in with your `@sdlccorp.com` email. In development, if `SMTP_HOST` is empty the login code is printed to the server console instead of emailed.

Generate a secret:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

## Production

```bash
npm run build
npm start
```

- `SESSION_SECRET` and `SMTP_*` are **required** (the app refuses to send codes without SMTP in production).
- Serve over HTTPS. Session cookies are `Secure` in production unless `COOKIE_SECURE=false`.
- Data lives in MongoDB (MONGODB_URI, MONGODB_DB). To copy an old SQLite database across: node --env-file=.env scripts/migrate-sqlite-to-mongo.mjs
- Run a single instance: the login rate limiter is in-memory.

## Security notes

- The allowed domain is hard-coded in `src/lib/auth-domain.ts` and enforced on the server at code request, code verification and on every page load and action.
- Login codes are 6 digits, stored as HMAC hashes, expire after 10 minutes, allow 5 attempts, and can be re-sent after 60 seconds. There is also a per-IP limit.
- Sessions are HS256-signed JWTs in an `httpOnly`, `SameSite=Lax` cookie (12 h by default, `SESSION_HOURS`).
- Every server action re-checks the session. Changes are written to the `audit_log` table, which records key names but never values.
- Env values are encrypted with AES-256-GCM before they reach MongoDB, using ENV_ENCRYPTION_KEY, which is never stored in the database. Back the key up: without it, stored values cannot be recovered.

## Project layout

```text
src/
  proxy.ts                      optimistic auth redirect (Next 16 "middleware")
  app/login/                    OTP sign-in
  app/(portal)/env-pack/        EnvPack pages
  components/envpack/           EnvPack UI
  lib/auth-actions.ts           request/verify OTP, logout
  lib/envpack/actions.ts        EnvPack mutations (server actions)
  lib/envpack/queries.ts        EnvPack reads
  lib/server/                   db, session check (DAL), mailer, rate limit
```
