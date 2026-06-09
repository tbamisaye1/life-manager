-- Life Manager local database schema (SQLite).
-- 100% local. No cloud, no AWS. One file lives in server/db/.

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

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
  project_id    TEXT REFERENCES projects(id) ON DELETE SET NULL,
  source        TEXT NOT NULL DEFAULT 'local',   -- local | google | notion
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

CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_events_start ON events(start);
CREATE INDEX IF NOT EXISTS idx_emails_received ON emails(received_at);
