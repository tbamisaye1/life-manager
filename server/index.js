import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { execFileSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { db } from './db/index.js'
import { errorMiddleware } from './lib/http.js'

import tasks from './routes/tasks.js'
import projects from './routes/projects.js'
import events from './routes/events.js'
import priorities from './routes/priorities.js'
import improvements from './routes/improvements.js'
import notes from './routes/notes.js'
import pages from './routes/pages.js'
import emails from './routes/emails.js'
import replyQueue from './routes/replyQueue.js'
import rugby from './routes/rugby.js'
import gym from './routes/gym.js'
import favorites from './routes/favorites.js'
import integrations from './routes/integrations.js'
import dashboard from './routes/dashboard.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT || 4000

app.use(cors())
app.use(express.json({ limit: '1mb' }))

// Auto-seed on first boot so the app is alive immediately.
const seeded = db.prepare('SELECT COUNT(*) c FROM projects').get().c > 0
if (!seeded) {
  try {
    execFileSync('node', [join(__dirname, 'db', 'seed.js')], { stdio: 'inherit' })
  } catch (e) {
    console.error('Seed failed:', e.message)
  }
}

app.get('/api/health', (req, res) => res.json({ ok: true, ts: new Date().toISOString() }))

app.use('/api/tasks', tasks)
app.use('/api/projects', projects)
app.use('/api/events', events)
app.use('/api/priorities', priorities)
app.use('/api/improvements', improvements)
app.use('/api/notes', notes)
app.use('/api/pages', pages)
app.use('/api/emails', emails)
app.use('/api/reply-queue', replyQueue)
app.use('/api/rugby', rugby)
app.use('/api/gym', gym)
app.use('/api/favorites', favorites)
app.use('/api/integrations', integrations)
app.use('/api', dashboard)

app.use(errorMiddleware)

app.listen(PORT, () => {
  console.log(`\n  🌱 Life Manager API running locally at http://localhost:${PORT}`)
  console.log('  (Local SQLite only — no cloud, no AWS.)\n')
})
