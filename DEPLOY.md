# Deploying Life Manager (Neon Postgres + Vercel)

The app is hostable as-is: the **frontend** (Vite build) and the **API** (Express
running as a Vercel serverless function) both deploy to Vercel, with data in a
free **Neon** Postgres database.

> Create Neon + Vercel accounts/projects dedicated to this app. Keep secrets in
> Vercel env vars — never commit them.

## How the database works

- **Local dev:** no setup. If `DATABASE_URL` is empty, the app runs an embedded
  Postgres (PGlite) stored in `server/db/` — same SQL dialect as production.
- **Production:** set `DATABASE_URL` to your Neon connection string. The schema
  is created automatically on first request; demo data seeds once if the DB is
  empty.

## 1. Create the Neon database (free)

1. Sign up at https://neon.tech and create a new project (any region near you).
2. In **Connection Details**, copy the connection string. It looks like:
   `postgresql://USER:PASSWORD@ep-xxxx.region.aws.neon.tech/neondb?sslmode=require`
3. (Optional) Test locally: put it in `.env` as `DATABASE_URL=...`, run
   `npm run dev`, and confirm the app loads against Neon. Remove it from `.env`
   afterwards to go back to local PGlite, or keep it.

**Never commit connection strings or passwords.** Store credentials only in `.env` (local) or Vercel environment variables (production).

## 2. Deploy to Vercel (free)

1. Push this repo to GitHub (already done: `tbamisaye1/life-manager`).
2. At https://vercel.com → **Add New → Project** → import the repo.
3. Framework preset: **Vite** (auto-detected). The included `vercel.json` already
   sets the build (`npm run build` → `dist`) and routes `/api/*` to the
   serverless function in `api/`.
4. **Environment Variables** → add `DATABASE_URL` = your Neon string. Add any
   integration secrets you use too (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
   `NOTION_TOKEN`, …). To **lock** the deployed app (recommended once public),
   set `APP_PIN` to a private 6-digit code — leave it unset only for an open demo.
   For OAuth redirect URIs, use your Vercel URL, e.g.
   `https://<your-app>.vercel.app/api/integrations/google/callback`.
5. **Deploy.** Vercel builds the frontend and runs the API as a function. On the
   first API request the schema is created and demo data seeds once.

## 3. After deploy

- Visit your Vercel URL — the app should load and work.
- To wipe/reseed the hosted DB later: run locally with `DATABASE_URL` set to Neon
  and `npm run seed -- --force` (this resets the remote data — use with care).

## Notes

- Serverless functions are stateless; all persistence is in Neon. Cold starts
  create a fresh DB connection and ensure the schema exists (idempotent).
- The local `server/db/life-manager.pglite/` folder is gitignored and never used
  in production.
