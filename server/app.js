import 'dotenv/config'
import 'express-async-errors'
import express from 'express'
import cors from 'cors'

import { initDb } from './db/index.js'
import { seedIfEmpty } from './db/seed.js'
import { errorMiddleware } from './lib/http.js'
import { requirePin } from './lib/pinAuth.js'

import auth from './routes/auth.js'
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
import boredItems from './routes/boredItems.js'
import pins from './routes/pins.js'
import search from './routes/search.js'
import assistant from './routes/assistant.js'
import dashboard from './routes/dashboard.js'
import settings from './routes/settings.js'

// One-time DB init per process (works for both `node` and serverless cold starts).
let initPromise = null
export function ensureInit() {
  if (!initPromise) {
    initPromise = (async () => {
      const label = await initDb()
      await seedIfEmpty()
      return label
    })()
  }
  return initPromise
}

export const app = express()
app.use(cors({ origin: true, credentials: true }))
app.use(express.json({ limit: '1mb' }))

// Ensure the schema + seed exist before handling any API request.
app.use(async (req, res, next) => {
  try { await ensureInit(); next() } catch (err) { next(err) }
})

app.get('/api/health', (req, res) => res.json({ ok: true, ts: new Date().toISOString() }))

// Passcode gate — only when APP_PIN is set (production). Unset = open demo.
app.use(requirePin)
app.use('/api/auth', auth)

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
app.use('/api/bored-items', boredItems)
app.use('/api/pins', pins)
app.use('/api/search', search)
app.use('/api/assistant', assistant)
app.use('/api/settings', settings)
app.use('/api', dashboard)

app.use(errorMiddleware)

export default app
