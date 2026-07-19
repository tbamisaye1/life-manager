# Life Manager — Setup

A personal life-management app that unifies tasks, calendar, email, projects,
goals, and more into one calm, Notion-inspired UI.

> **Privacy / isolation:** by default everything runs locally on an embedded
> Postgres (PGlite) in `server/db/` — zero setup, no accounts. For persistent
> hosting, point `DATABASE_URL` at a Neon Postgres database (see **DEPLOY.md**).
> Either way it's a completely separate space — nothing here can touch Rotunda.

## Run it locally

```bash
npm install      # install dependencies (already done if you cloned with node_modules)
npm run dev      # starts BOTH the Vite frontend and the local API
```

- Frontend: http://localhost:5180
- API: http://localhost:4000 (the frontend proxies `/api` here)

The database auto-creates and seeds realistic demo data on first boot, so the
app is fully usable immediately — no accounts required.

Other scripts:

```bash
npm run build         # production build
npm run lint          # eslint
npm run seed -- --force   # wipe + reseed the local database
```

## Connecting real accounts (optional)

The app works on local data without any of this. To turn on real sync, copy
`.env.example` to `.env` and fill in credentials, then restart the server.

### Google (Calendar + Gmail)
1. Go to the [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials).
2. Create an **OAuth 2.0 Client ID** (type: *Web application*).
3. Add the redirect URI: `http://localhost:4000/api/integrations/google/callback`
4. Enable the **Google Calendar API** and **Gmail API** for the project.
5. Put the client id/secret in `.env` (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`).
6. Restart, open **Settings & Sync**, and click **Connect** under Google.

### Microsoft / Outlook (Calendar)
1. Go to [Azure Portal → App registrations](https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade) and create a registration.
2. Account types: **Accounts in any organizational directory and personal Microsoft accounts**.
3. Add a **Web** redirect URI: `http://localhost:4000/api/integrations/microsoft/callback` (and your Vercel URL in prod).
4. Certificates & secrets → create a client secret.
5. API permissions → Microsoft Graph **delegated**: `User.Read`, `Calendars.ReadWrite` (and grant admin consent if required). `offline_access` is requested at auth time.
6. Put `MICROSOFT_CLIENT_ID` and `MICROSOFT_CLIENT_SECRET` in `.env`, restart, then **Connect** under Outlook / Microsoft in Settings.

### Notion
- Easiest: create an [internal integration](https://www.notion.so/my-integrations),
  share your databases with it, and put its token in `.env` as `NOTION_TOKEN`.
- Or set up full OAuth with `NOTION_CLIENT_ID` / `NOTION_CLIENT_SECRET` and the
  redirect URI `http://localhost:4000/api/integrations/notion/callback`.
- In **Settings & Sync**, paste a Notion database ID to pull its tasks in.

## What's where

```
src/
  components/   reusable UI primitives + feature components
  pages/        one file per route (thin — they compose components)
  hooks/        TanStack Query data hooks
  lib/          api client, formatting, colors, nav config
server/
  routes/       REST API (tasks, events, projects, …)
  integrations/ Google + Notion adapters
  db/           schema + seed (PGlite local / Neon prod)
.claude/agents/ the agent team that built & reviews this app
```
