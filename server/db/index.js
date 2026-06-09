import Database from 'better-sqlite3'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Single local SQLite file. Never a remote/cloud connection.
const DB_PATH = join(__dirname, 'life-manager.sqlite')

export const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

// Apply schema on every boot (idempotent — uses IF NOT EXISTS).
const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf8')
db.exec(schema)

export default db
