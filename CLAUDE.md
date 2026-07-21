# Life Manager — project instructions

See **`../AGENTS.md`** for full workspace instructions (web + mobile + agent team).

A personal, **local-first** life-management app. React 19 + Vite + Tailwind v4
frontend; Express + PGlite (local) / Neon Postgres (prod) backend. Notion/OneNote-inspired, calm,
component-heavy. See `SETUP.md` to run it.

## Git workflow (REQUIRED — never lose progress)

1. **Never build features directly on `main`.** Before starting any feature or
   non-trivial change, create a branch:
   `git checkout -b feature/<short-name>` (or `fix/…`, `chore/…`).
2. **Commit at every working milestone** — after each cohesive step that builds
   and lints clean. Small, frequent commits beat one giant commit. Aim to commit
   before moving to the next sub-task, and whenever `npm run build` + `npm run lint`
   are green.
3. **Push regularly** so work is backed up to GitHub (`git push -u origin <branch>`),
   at least at the end of every working session.
4. **Merge to `main` only when the feature works** and the build/lint/runtime are
   verified (the taskmaster gate). Use a PR (`gh pr create`) or fast-forward merge.
5. End commit messages with the Co-Authored-By trailer.
6. Keep `main` always-runnable.

## Ports & hosting

Life Manager runs on **5180 (web)** and **4000 (api)** locally. Don't collide
with other projects on those ports. Production uses dedicated Neon + Vercel
(see `DEPLOY.md`).

## Dev

- `npm run dev` — runs frontend (5180) + API (4000) together
- `npm run build` / `npm run lint` — must pass before merging
- `npm run seed -- --force` — reset local demo data

## Conventions

- Component-heavy: small, single-purpose files (~<150 lines); pages stay thin and
  compose components. Reuse `src/components/ui/` primitives; never duplicate long
  Tailwind strings — extract a component.
- Data access via TanStack Query hooks (`src/hooks/`), never raw `fetch` in views.
- Every data view has loading / empty / error states.
- Mobile counterpart: `../Life-Manager-Mobile/` — shared API, separate repo.
- Agent team lives in `../.cursor/agents/` (backend-engineer, frontend-architect,
  mobile-engineer, code-reviewer, design-expert, user-simulator, taskmaster).
