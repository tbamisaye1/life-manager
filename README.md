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
- In-app AI assistant (LangGraph ReAct agent, OpenAI tools)
- Optional Google Calendar + Gmail, Outlook, Notion

## Stack

| Layer | Tech |
| --- | --- |
| Frontend | React 19, Vite, Tailwind v4, TanStack Query |
| Backend | Express |
| Database | PGlite locally, Neon in production |
| Hosting | Vercel |
| AI assistant | LangChain, LangGraph, OpenAI |

## How I built this

I built Life Manager as a real app I use, and also as a place to learn agentic coding with Claude Code (and Cursor). Not autocomplete-only: full workflows with agents that plan, implement, review, and verify.

In practice that meant:

- Agent teams / multi-agent orchestration: a lead session delegates to specialized subagents instead of one chat doing everything
- Custom subagents with scoped roles: `backend-engineer`, `frontend-architect`, `mobile-engineer`, `code-reviewer`, `design-expert`, `user-simulator`, `taskmaster` (see `.claude/agents/`)
- Parallel agents on API + web (+ mobile), with separate local ports/DB slots so they do not collide
- Skills (reusable playbooks agents load when the task matches)
- Task lists and commits at each green build
- Done gates via `taskmaster` (build, lint, boot, checklist) before calling something finished
- Read-only review loops: code review, design critique, and user-journey simulation as separate passes
- Project instructions so every session knows ports, conventions, and which surface to edit

## AI assistant

Separate from how the code was built: the app has a chat assistant that can read and change your Life Manager data through tools.

ReAct agent (`createReactAgent`) over OpenAI, with tools for schedule, tasks, gym notation like `5x10@20kg`, notes, pinboard, rugby, and inbox. The UI shows chips for what it actually did.

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
