-- Life Manager database schema (Postgres dialect).
-- Local dev runs this on embedded PGlite; production runs it on Neon Postgres.
-- Isolated from any other project. No shared infrastructure.

-- Projects / jobs the user is juggling (Rotunda, ISPS, labs, sisters, etc.)
CREATE TABLE IF NOT EXISTS projects (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  short_code    TEXT,                       -- e.g. "Rotunda", "ISPS", "S&DS"
  color         TEXT NOT NULL DEFAULT 'slate',
  emoji         TEXT,
  description    TEXT,
  last_worked_at TEXT,                       -- ISO timestamp of last logged work
  archived       INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL
);

-- Tasks / assignments (Notion-style: due date + deadline + recurrence).
CREATE TABLE IF NOT EXISTS tasks (
  id            TEXT PRIMARY KEY,
  title         TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'todo',   -- todo | doing | done
  emoji         TEXT,
  due_date      TEXT,                            -- ISO date/datetime
  priority      TEXT NOT NULL DEFAULT 'normal',  -- low | normal | high | urgent
  recurrence    TEXT NOT NULL DEFAULT 'single',  -- single | daily | weekly | monthly
  project_id    TEXT REFERENCES projects(id) ON DELETE SET NULL,
  notes         TEXT,
  source        TEXT NOT NULL DEFAULT 'local',   -- local | google | notion
  external_id   TEXT,                            -- id in the source system
  completed_at  TEXT,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

-- Calendar events (local + synced from Google/Notion).
CREATE TABLE IF NOT EXISTS events (
  id            TEXT PRIMARY KEY,
  title         TEXT NOT NULL,
  start         TEXT NOT NULL,                   -- ISO datetime (or date for all-day)
  "end"         TEXT,
  all_day       INTEGER NOT NULL DEFAULT 0,
  location      TEXT,
  notes         TEXT,
  color         TEXT NOT NULL DEFAULT 'slate',
  flagship      INTEGER NOT NULL DEFAULT 1,       -- 1 = show on the month Calendar overview
  series_id     TEXT,                            -- groups occurrences of a recurring event
  project_id    TEXT REFERENCES projects(id) ON DELETE SET NULL,
  source        TEXT NOT NULL DEFAULT 'local',   -- local | google | notion | assistant
  external_id   TEXT,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

-- Daily / recurring priorities checklist ("things I should check this summer").
CREATE TABLE IF NOT EXISTS priorities (
  id            TEXT PRIMARY KEY,
  title         TEXT NOT NULL,
  cadence       TEXT NOT NULL DEFAULT 'daily',   -- daily | weekly
  emoji         TEXT,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  last_done_at  TEXT,                            -- last time it was checked off
  active        INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

-- Improvement points / goals — each gets its own page.
CREATE TABLE IF NOT EXISTS improvements (
  id            TEXT PRIMARY KEY,
  title         TEXT NOT NULL,
  emoji         TEXT,
  category      TEXT,                            -- career | skill | personal | fitness ...
  summary       TEXT,                            -- short blurb
  body          TEXT,                            -- the page content (markdown-ish)
  why           TEXT,                            -- why this matters
  progress      INTEGER NOT NULL DEFAULT 0,      -- 0-100
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

-- Discrete action items / log entries under an improvement.
CREATE TABLE IF NOT EXISTS improvement_actions (
  id             TEXT PRIMARY KEY,
  improvement_id TEXT NOT NULL REFERENCES improvements(id) ON DELETE CASCADE,
  text           TEXT NOT NULL,
  done           INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT NOT NULL
);

-- Quick notes / ideas capture.
CREATE TABLE IF NOT EXISTS notes (
  id            TEXT PRIMARY KEY,
  title         TEXT,
  body          TEXT NOT NULL DEFAULT '',
  pinned        INTEGER NOT NULL DEFAULT 0,
  color         TEXT NOT NULL DEFAULT 'default',
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

-- Email interface (seed/mock + Gmail sync). Pin + note-to-reply.
CREATE TABLE IF NOT EXISTS emails (
  id            TEXT PRIMARY KEY,
  from_name     TEXT,
  from_email    TEXT,
  subject       TEXT,
  snippet       TEXT,
  body          TEXT,
  received_at   TEXT NOT NULL,
  is_read       INTEGER NOT NULL DEFAULT 0,
  pinned        INTEGER NOT NULL DEFAULT 0,
  reply_note    TEXT,                            -- "what I want to say back"
  needs_reply   INTEGER NOT NULL DEFAULT 0,
  project_id    TEXT REFERENCES projects(id) ON DELETE SET NULL,
  source        TEXT NOT NULL DEFAULT 'local',   -- local | google
  external_id   TEXT,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

-- Reply queue: cross-platform messages I owe (manual stand-in for iMessage/WA/etc.)
CREATE TABLE IF NOT EXISTS reply_queue (
  id            TEXT PRIMARY KEY,
  person        TEXT NOT NULL,
  platform      TEXT NOT NULL DEFAULT 'imessage', -- imessage | whatsapp | instagram | snapchat | email | other
  context       TEXT,
  due_date      TEXT,
  done          INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

-- Rugby: sessions (games/training) and skills to improve.
CREATE TABLE IF NOT EXISTS rugby_sessions (
  id            TEXT PRIMARY KEY,
  date          TEXT NOT NULL,
  type          TEXT NOT NULL DEFAULT 'training', -- game | training
  opponent      TEXT,
  position      TEXT,
  rating        INTEGER,                          -- self-rating 1-10
  metrics       TEXT,                             -- JSON: tackles, meters, tries, etc.
  notes         TEXT,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS rugby_skills (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  current_level INTEGER NOT NULL DEFAULT 3,       -- 1-10
  target_level  INTEGER NOT NULL DEFAULT 8,
  notes         TEXT,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

-- Sidebar favorites (pinned links to any entity/page).
CREATE TABLE IF NOT EXISTS favorites (
  id            TEXT PRIMARY KEY,
  label         TEXT NOT NULL,
  icon          TEXT,
  path          TEXT NOT NULL,                    -- frontend route
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL
);

-- Recently visited pages (sidebar "recents").
CREATE TABLE IF NOT EXISTS recents (
  path          TEXT PRIMARY KEY,
  label         TEXT NOT NULL,
  icon          TEXT,
  visited_at    TEXT NOT NULL
);

-- OAuth tokens for integrations (local only).
CREATE TABLE IF NOT EXISTS integration_accounts (
  provider      TEXT PRIMARY KEY,                 -- google | notion
  account_label TEXT,
  access_token  TEXT,
  refresh_token TEXT,
  expiry        TEXT,
  scope         TEXT,
  raw           TEXT,
  connected_at  TEXT,
  last_synced_at TEXT
);

-- Hierarchical pages: the OneNote/Notion-style notes workspace. A page can hold
-- subpages to any depth (parent_id self-reference). body is TipTap JSON (string).
CREATE TABLE IF NOT EXISTS pages (
  id            TEXT PRIMARY KEY,
  parent_id     TEXT REFERENCES pages(id) ON DELETE CASCADE,
  host_type     TEXT,                            -- task | project | improvement | null
  host_id       TEXT,                            -- id of the host entity
  title         TEXT NOT NULL DEFAULT 'Untitled',
  icon          TEXT,                            -- emoji
  color         TEXT,                            -- optional accent for top sections
  body          TEXT NOT NULL DEFAULT '',        -- TipTap JSON (stringified)
  is_focus      INTEGER NOT NULL DEFAULT 0,      -- surface in the "Bored / Focus" list
  sort_order    INTEGER NOT NULL DEFAULT 0,
  archived      INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_pages_parent ON pages(parent_id);

-- ===== Gym / Rehab tracking =====
-- The exercise library.
CREATE TABLE IF NOT EXISTS gym_exercises (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  category      TEXT NOT NULL DEFAULT 'strength', -- strength | rehab | mobility | conditioning
  muscle_group  TEXT,
  unit          TEXT NOT NULL DEFAULT 'kg',        -- kg | lb | bodyweight | band | time
  rep_low       INTEGER NOT NULL DEFAULT 8,        -- target rep range
  rep_high      INTEGER NOT NULL DEFAULT 12,
  default_sets  INTEGER NOT NULL DEFAULT 3,
  increment     REAL NOT NULL DEFAULT 2.5,         -- weight step for progression
  notes         TEXT,
  archived      INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

-- A day template ("Push", "Rehab", "Legs"). weekday (0=Sun..6=Sat) schedules it.
CREATE TABLE IF NOT EXISTS gym_routines (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  emoji         TEXT,
  color         TEXT NOT NULL DEFAULT 'violet',
  weekday       INTEGER,                            -- null = unscheduled
  notes         TEXT,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS gym_routine_exercises (
  id            TEXT PRIMARY KEY,
  routine_id    TEXT NOT NULL REFERENCES gym_routines(id) ON DELETE CASCADE,
  exercise_id   TEXT NOT NULL REFERENCES gym_exercises(id) ON DELETE CASCADE,
  target_sets   INTEGER NOT NULL DEFAULT 3,
  sort_order    INTEGER NOT NULL DEFAULT 0
);

-- An actual gym visit on a date.
CREATE TABLE IF NOT EXISTS gym_workouts (
  id            TEXT PRIMARY KEY,
  date          TEXT NOT NULL,                      -- YYYY-MM-DD
  routine_id    TEXT REFERENCES gym_routines(id) ON DELETE SET NULL,
  title         TEXT,
  notes         TEXT,
  completed     INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

-- A single logged set within a workout.
CREATE TABLE IF NOT EXISTS gym_sets (
  id            TEXT PRIMARY KEY,
  workout_id    TEXT NOT NULL REFERENCES gym_workouts(id) ON DELETE CASCADE,
  exercise_id   TEXT NOT NULL REFERENCES gym_exercises(id) ON DELETE CASCADE,
  set_number    INTEGER NOT NULL DEFAULT 1,
  weight        REAL,
  reps          INTEGER,
  rpe           REAL,
  done          INTEGER NOT NULL DEFAULT 1,
  notes         TEXT NOT NULL DEFAULT '',          -- per-set note ("felt heavy", "left knee twinge")
  created_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_gym_sets_workout ON gym_sets(workout_id);
CREATE INDEX IF NOT EXISTS idx_gym_sets_exercise ON gym_sets(exercise_id);
CREATE INDEX IF NOT EXISTS idx_gym_workouts_date ON gym_workouts(date);

-- "I'm Bored" list: a user-curated list of things to come back to (learn chess,
-- a side idea, self-improvement). NOT auto-generated. Each item has a rich body.
CREATE TABLE IF NOT EXISTS bored_items (
  id            TEXT PRIMARY KEY,
  title         TEXT NOT NULL,
  emoji         TEXT,
  category      TEXT,                            -- learn | project | fun | improve | other
  body          TEXT NOT NULL DEFAULT '',        -- TipTap JSON (stringified)
  done          INTEGER NOT NULL DEFAULT 0,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

-- Small key/value store for app-wide settings (e.g. home_timezone).
CREATE TABLE IF NOT EXISTS app_settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);

-- Connected Google accounts (multiple). Each holds its own OAuth tokens.
CREATE TABLE IF NOT EXISTS google_accounts (
  email          TEXT PRIMARY KEY,
  label          TEXT,                            -- friendly label (work/school/personal)
  access_token   TEXT,
  refresh_token  TEXT,
  expiry         TEXT,
  scope          TEXT,
  is_default     INTEGER NOT NULL DEFAULT 0,      -- where new events go unless told otherwise
  connected_at   TEXT,
  last_synced_at TEXT
);

-- Calendars discovered under each account; `selected` toggles sync/visibility.
CREATE TABLE IF NOT EXISTS google_calendars (
  id             TEXT PRIMARY KEY,                -- `${email}::${calendar_id}`
  account_email  TEXT NOT NULL REFERENCES google_accounts(email) ON DELETE CASCADE,
  calendar_id    TEXT NOT NULL,
  summary        TEXT,
  color          TEXT,
  is_primary     INTEGER NOT NULL DEFAULT 0,
  access_role    TEXT,                            -- owner | writer | reader
  timezone       TEXT,                            -- IANA tz for correct write-back
  selected       INTEGER NOT NULL DEFAULT 1,
  created_at     TEXT,
  updated_at     TEXT
);
CREATE INDEX IF NOT EXISTS idx_google_calendars_account ON google_calendars(account_email);

-- Pinboard: quick-capture sticky notes for fleeting thoughts/ideas/reminders.
-- Deliberately frictionless — type and go, delete when done. Mobile-first.
CREATE TABLE IF NOT EXISTS pins (
  id            TEXT PRIMARY KEY,
  body          TEXT NOT NULL,
  color         TEXT NOT NULL DEFAULT 'amber',     -- sticky-note tint
  pinned        INTEGER NOT NULL DEFAULT 0,         -- keep important ones at top
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_pins_created ON pins(created_at);

-- Assistant chat history (ChatGPT-style conversations).
CREATE TABLE IF NOT EXISTS chat_conversations (
  id            TEXT PRIMARY KEY,
  title         TEXT NOT NULL DEFAULT 'New chat',
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS chat_messages (
  id              TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
  role            TEXT NOT NULL,                 -- user | assistant
  content         TEXT NOT NULL DEFAULT '',
  actions         TEXT,                          -- JSON array of action strings
  created_at      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_chat_messages_conv ON chat_messages(conversation_id);

CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_events_start ON events(start);
CREATE INDEX IF NOT EXISTS idx_emails_received ON emails(received_at);
