import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ---------------------------------------------------------------------------
// Driver: Neon Postgres in production (DATABASE_URL set), embedded PGlite for
// local dev (zero setup, same Postgres SQL). Both expose async query(text,vals).
// ---------------------------------------------------------------------------
let clientPromise = null

async function getClient() {
  if (clientPromise) return clientPromise
  clientPromise = (async () => {
    if (process.env.DATABASE_URL) {
      const pg = (await import('pg')).default
      const pool = new pg.Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }, // Neon requires SSL
        max: 5,
      })
      return {
        query: (text, values) => pool.query(text, values),
        exec: (text) => pool.query(text),
        label: 'neon-postgres',
      }
    }
    const { PGlite } = await import('@electric-sql/pglite')
    const pglite = new PGlite(join(__dirname, 'life-manager.pglite'))
    await pglite.waitReady
    return {
      query: (text, values) => pglite.query(text, values),
      exec: (text) => pglite.exec(text),
      label: 'pglite-local',
    }
  })()
  return clientPromise
}

// Translate better-sqlite3-style placeholders to Postgres $n.
//  - `@name` → $k (each unique name mapped once and reused)
//  - `?`     → positional $k
// Queries in this codebase use one style at a time.
function translate(sql) {
  const names = []
  let out = sql.replace(/@(\w+)/g, (_, name) => {
    let i = names.indexOf(name)
    if (i === -1) { names.push(name); i = names.length - 1 }
    return `$${i + 1}`
  })
  let positional = false
  if (out.includes('?')) {
    positional = true
    let n = 0
    out = out.replace(/\?/g, () => `$${++n}`)
  }
  return { text: out, names, positional }
}

function bindValues({ names, positional }, args) {
  if (positional) return args
  if (names.length === 0) return []
  const obj = args[0] || {}
  return names.map((n) => (obj[n] === undefined ? null : obj[n]))
}

// A prepared statement with async .all/.get/.run, matching the old call sites
// (which now `await`). Keeps existing SQL strings unchanged.
function prepare(sql) {
  const plan = translate(sql)
  const run = async (args) => {
    const client = await getClient()
    return client.query(plan.text, bindValues(plan, args))
  }
  return {
    all: async (...args) => (await run(args)).rows,
    get: async (...args) => (await run(args)).rows[0],
    run: async (...args) => { const r = await run(args); return { changes: r.rowCount ?? 0 } },
  }
}

export const db = {
  prepare,
  exec: async (text) => { (await getClient()).exec(text) },
}

// ---------------------------------------------------------------------------
// Schema + lightweight migrations. Postgres supports IF NOT EXISTS on both
// CREATE TABLE/INDEX and ALTER TABLE ADD COLUMN, so this stays idempotent.
// ---------------------------------------------------------------------------
export async function initDb() {
  const client = await getClient()
  const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf8')
  await client.exec(schema)
  await client.exec("ALTER TABLE priorities ADD COLUMN IF NOT EXISTS body TEXT NOT NULL DEFAULT ''")
  // Existing events default to flagship=1 so they stay on the month Calendar.
  await client.exec('ALTER TABLE events ADD COLUMN IF NOT EXISTS flagship INTEGER NOT NULL DEFAULT 1')
  // Per-set notes for the gym logger.
  await client.exec("ALTER TABLE gym_sets ADD COLUMN IF NOT EXISTS notes TEXT NOT NULL DEFAULT ''")
  // Recurring-event series grouping.
  await client.exec('ALTER TABLE events ADD COLUMN IF NOT EXISTS series_id TEXT')
  // Which Google account/calendar a synced event belongs to (for write-back).
  await client.exec('ALTER TABLE events ADD COLUMN IF NOT EXISTS google_account TEXT')
  await client.exec('ALTER TABLE events ADD COLUMN IF NOT EXISTS google_calendar_id TEXT')
  await client.exec('ALTER TABLE google_calendars ADD COLUMN IF NOT EXISTS timezone TEXT')
  // Pages can be attached to tasks, projects, etc. (Notion-style nesting anywhere).
  await client.exec('ALTER TABLE pages ADD COLUMN IF NOT EXISTS host_type TEXT')
  await client.exec('ALTER TABLE pages ADD COLUMN IF NOT EXISTS host_id TEXT')
  await client.exec('ALTER TABLE gym_exercises ADD COLUMN IF NOT EXISTS target_weight REAL')
  // Per-instance flagship override — survives Google sync.
  await client.exec('ALTER TABLE events ADD COLUMN IF NOT EXISTS flagship_override INTEGER NOT NULL DEFAULT 0')
  // Bracket-titled events (e.g. "[All Hands]") belong on the month overview.
  await client.exec("UPDATE events SET flagship = 1 WHERE flagship = 0 AND title LIKE '[%'")
  return client.label
}

export default db
