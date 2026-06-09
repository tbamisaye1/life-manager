import { Router } from 'express'
import { db } from '../db/index.js'

const router = Router()

// Global search across every navigable entity. Returns flat, ranked-ish results
// the command palette renders and navigates to.
router.get('/', async (req, res) => {
  const q = (req.query.q || '').trim()
  if (q.length < 1) return res.json({ results: [] })
  const like = `%${q}%`
  const results = []
  const add = (rows, map) => rows.forEach((r) => results.push(map(r)))

  add(await db.prepare("SELECT id, title FROM tasks WHERE title ILIKE ? LIMIT 6").all(like),
    (r) => ({ type: 'task', id: r.id, title: r.title, subtitle: 'Task', path: '/tasks' }))

  add(await db.prepare("SELECT id, title, start FROM events WHERE title ILIKE ? ORDER BY start DESC LIMIT 6").all(like),
    (r) => ({ type: 'event', id: r.id, title: r.title, subtitle: 'Event', path: '/calendar' }))

  add(await db.prepare("SELECT id, name, short_code FROM projects WHERE name ILIKE ? OR short_code ILIKE ? LIMIT 6").all(like, like),
    (r) => ({ type: 'project', id: r.id, title: r.name, subtitle: 'Project', path: `/projects/${r.id}` }))

  add(await db.prepare("SELECT id, title, icon FROM pages WHERE archived = 0 AND (title ILIKE ? OR body ILIKE ?) LIMIT 8").all(like, like),
    (r) => ({ type: 'page', id: r.id, title: r.title || 'Untitled', subtitle: 'Page', icon: r.icon, path: `/notes/${r.id}` }))

  add(await db.prepare("SELECT id, title, summary FROM improvements WHERE title ILIKE ? OR summary ILIKE ? LIMIT 6").all(like, like),
    (r) => ({ type: 'improvement', id: r.id, title: r.title, subtitle: 'Improvement', path: `/improvements/${r.id}` }))

  add(await db.prepare("SELECT id, title FROM priorities WHERE active = 1 AND title ILIKE ? LIMIT 5").all(like),
    (r) => ({ type: 'priority', id: r.id, title: r.title, subtitle: 'Priority', path: '/priorities' }))

  add(await db.prepare("SELECT id, title FROM bored_items WHERE title ILIKE ? LIMIT 5").all(like),
    (r) => ({ type: 'bored', id: r.id, title: r.title, subtitle: 'Bored list', path: '/bored' }))

  add(await db.prepare("SELECT id, subject, from_name FROM emails WHERE subject ILIKE ? OR from_name ILIKE ? ORDER BY received_at DESC LIMIT 5").all(like, like),
    (r) => ({ type: 'email', id: r.id, title: r.subject || '(no subject)', subtitle: r.from_name ? `Email · ${r.from_name}` : 'Email', path: '/email' }))

  add(await db.prepare("SELECT id, name, category FROM gym_exercises WHERE archived = 0 AND name ILIKE ? LIMIT 5").all(like),
    (r) => ({ type: 'exercise', id: r.id, title: r.name, subtitle: `Exercise · ${r.category}`, path: '/gym' }))

  // Exact title matches first, then the rest.
  const lower = q.toLowerCase()
  results.sort((a, b) => (b.title.toLowerCase() === lower) - (a.title.toLowerCase() === lower)
    || a.title.toLowerCase().indexOf(lower) - b.title.toLowerCase().indexOf(lower))

  res.json({ results: results.slice(0, 24) })
})

export default router
