import { Router } from 'express'
import { db } from '../db/index.js'
import { newId, now, buildUpdate } from '../lib/helpers.js'
import { httpError } from '../lib/http.js'

const router = Router()

// Parse the metrics JSON column into an object for the client.
function decodeSession(row) {
  if (!row) return row
  let metrics = {}
  try { if (row.metrics) metrics = JSON.parse(row.metrics) } catch { /* keep default */ }
  return { ...row, metrics }
}

// --- Sessions (games / training) ---
router.get('/sessions', (req, res) => {
  const rows = db.prepare('SELECT * FROM rugby_sessions ORDER BY date DESC').all()
  res.json(rows.map(decodeSession))
})

router.post('/sessions', (req, res) => {
  const { date, type } = req.body
  if (!date) return res.status(400).json(httpError('Date required', 'VALIDATION'))
  const ts = now(); const id = newId()
  db.prepare(`INSERT INTO rugby_sessions (id,date,type,opponent,position,rating,metrics,notes,created_at,updated_at)
    VALUES (@id,@date,@type,@opp,@pos,@rating,@metrics,@notes,@ts,@ts)`).run({
    id, date, type: type || 'training', opp: req.body.opponent || null, pos: req.body.position || null,
    rating: req.body.rating || null, metrics: JSON.stringify(req.body.metrics || {}), notes: req.body.notes || '', ts,
  })
  res.status(201).json(decodeSession(db.prepare('SELECT * FROM rugby_sessions WHERE id = ?').get(id)))
})

router.patch('/sessions/:id', (req, res) => {
  const patch = { ...req.body }
  if (patch.metrics && typeof patch.metrics === 'object') patch.metrics = JSON.stringify(patch.metrics)
  const upd = buildUpdate('rugby_sessions', req.params.id, patch, ['date', 'type', 'opponent', 'position', 'rating', 'metrics', 'notes'])
  if (upd) db.prepare(upd.sql).run(upd.params)
  res.json(decodeSession(db.prepare('SELECT * FROM rugby_sessions WHERE id = ?').get(req.params.id)))
})

router.delete('/sessions/:id', (req, res) => {
  db.prepare('DELETE FROM rugby_sessions WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

// --- Skills to improve ---
router.get('/skills', (req, res) => {
  res.json(db.prepare('SELECT * FROM rugby_skills ORDER BY sort_order, created_at').all())
})

router.post('/skills', (req, res) => {
  const { name } = req.body
  if (!name?.trim()) return res.status(400).json(httpError('Name required', 'VALIDATION'))
  const ts = now(); const id = newId()
  const max = db.prepare('SELECT COALESCE(MAX(sort_order), -1) m FROM rugby_skills').get().m
  db.prepare(`INSERT INTO rugby_skills (id,name,current_level,target_level,notes,sort_order,created_at,updated_at)
    VALUES (@id,@name,@cur,@tgt,@notes,@ord,@ts,@ts)`).run({
    id, name: name.trim(), cur: req.body.current_level || 3, tgt: req.body.target_level || 8,
    notes: req.body.notes || '', ord: max + 1, ts,
  })
  res.status(201).json(db.prepare('SELECT * FROM rugby_skills WHERE id = ?').get(id))
})

router.patch('/skills/:id', (req, res) => {
  const upd = buildUpdate('rugby_skills', req.params.id, req.body, ['name', 'current_level', 'target_level', 'notes', 'sort_order'])
  if (upd) db.prepare(upd.sql).run(upd.params)
  res.json(db.prepare('SELECT * FROM rugby_skills WHERE id = ?').get(req.params.id))
})

router.delete('/skills/:id', (req, res) => {
  db.prepare('DELETE FROM rugby_skills WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

export default router
