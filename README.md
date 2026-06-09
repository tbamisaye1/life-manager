# Life Manager

App I built for myself to run tasks, schedule, calendar, notes, projects, gym, rugby, email triage, and a pinboard in one place.

Clone it and you get demo seed data on local PGlite. That is not my production database. Hosted option is Neon on Vercel if you want that.

## Features

- Today / schedule
- Tasks and projects
- Calendar (recurring + flagship days)
- Nested notes (TipTap)
- Pinboard
- Gym and rugby logs
- Email / reply queue
- In-app assistant (LangGraph ReAct agent, OpenAI tools)
- Optional Google Calendar + Gmail, Outlook, Notion

## Stack

| Layer | Tech |
| --- | --- |
| Frontend | React 19, Vite, Tailwind v4, TanStack Query |
| Backend | Express |
| Database | PGlite locally, Neon in production |
| Hosting | Vercel |
| Assistant | LangChain, LangGraph, OpenAI |

While building this I used Cursor with scoped subagents under `.claude/agents/` (`backend-engineer`, `frontend-architect`, `mobile-engineer`, `code-reviewer`, `design-expert`, `user-simulator`, `taskmaster`).

## Assistant

ReAct agent (`createReactAgent`) with tools for schedule, tasks, gym notation like `5x10@20kg`, notes, pinboard, rugby, and inbox. The UI shows chips for what it did.

Needs `OPENAI_API_KEY` in `.env`. Everything else still works without it. Code: `server/lib/assistant/`.

## Clone and run

Node 20+ (22 is fine), npm, git.

```bash
git clone https://github.com/tbamisaye1/life-manager.git
cd life-manager
npm install
npm run dev
```

- Web: http://localhost:5180
- API: http://localhost:4000 (Vite proxies `/api`)

First boot makes the local DB and seeds demo data. No login. Leave `APP_PIN` unset for an unlocked local demo; set it if you want a passcode (see Privacy).

```bash
npm run build
npm run lint
npm run seed -- --force
```

OAuth keys are optional. Copy `.env.example` to `.env`. More in [`SETUP.md`](./SETUP.md).

Mobile app: [Life-Manager-Mobile](https://github.com/tbamisaye1/Life-Manager-Mobile).

## Deploy

Vercel + Neon. Steps in [`DEPLOY.md`](./DEPLOY.md). Secrets go in `.env` or Vercel env vars, not in git.

## Layout

```
src/                  React app
server/               API, schema, seed, integrations
server/lib/assistant  Agent + tools
.claude/agents/       Subagent role files
api/                  Vercel entry
```

## Privacy

Code only in this repo. Local PGlite dirs under `server/db/*.pglite/` are gitignored.

| Mode | `APP_PIN` | What happens |
| --- | --- | --- |
| Demo | unset | No lock. Normal after clone. |
| Protected | set in env | Passcode required. PIN is not in the repo. |

Editor chat logs stay on your machine. Only `.claude/agents/` role files are committed.
