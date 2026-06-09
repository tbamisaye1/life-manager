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
router.get('/sessions', async (req, res) => {
  const rows = await db.prepare('SELECT * FROM rugby_sessions ORDER BY date DESC').all()
  res.json(rows.map(decodeSession))
})

router.post('/sessions', async (req, res) => {
  const { date, type } = req.body
  if (!date) return res.status(400).json(httpError('Date required', 'VALIDATION'))
  const ts = now(); const id = newId()
  await db.prepare(`INSERT INTO rugby_sessions (id,date,type,opponent,position,rating,metrics,notes,created_at,updated_at)
    VALUES (@id,@date,@type,@opp,@pos,@rating,@metrics,@notes,@ts,@ts)`).run({
    id, date, type: type || 'training', opp: req.body.opponent || null, pos: req.body.position || null,
    rating: req.body.rating || null, metrics: JSON.stringify(req.body.metrics || {}), notes: req.body.notes || '', ts,
  })
  res.status(201).json(decodeSession(await db.prepare('SELECT * FROM rugby_sessions WHERE id = ?').get(id)))
})

router.patch('/sessions/:id', async (req, res) => {
  const patch = { ...req.body }
  if (patch.metrics && typeof patch.metrics === 'object') patch.metrics = JSON.stringify(patch.metrics)
  const upd = buildUpdate('rugby_sessions', req.params.id, patch, ['date', 'type', 'opponent', 'position', 'rating', 'metrics', 'notes'])
  if (upd) await db.prepare(upd.sql).run(upd.params)
  res.json(decodeSession(await db.prepare('SELECT * FROM rugby_sessions WHERE id = ?').get(req.params.id)))
})

router.delete('/sessions/:id', async (req, res) => {
  await db.prepare('DELETE FROM rugby_sessions WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

// --- Skills to improve ---
router.get('/skills', async (req, res) => {
  res.json(await db.prepare('SELECT * FROM rugby_skills ORDER BY sort_order, created_at').all())
})

router.post('/skills', async (req, res) => {
  const { name } = req.body
  if (!name?.trim()) return res.status(400).json(httpError('Name required', 'VALIDATION'))
  const ts = now(); const id = newId()
  const max = (await db.prepare('SELECT COALESCE(MAX(sort_order), -1) m FROM rugby_skills').get()).m
  await db.prepare(`INSERT INTO rugby_skills (id,name,current_level,target_level,notes,sort_order,created_at,updated_at)
    VALUES (@id,@name,@cur,@tgt,@notes,@ord,@ts,@ts)`).run({
    id, name: name.trim(), cur: req.body.current_level || 3, tgt: req.body.target_level || 8,
    notes: req.body.notes || '', ord: max + 1, ts,
  })
  res.status(201).json(await db.prepare('SELECT * FROM rugby_skills WHERE id = ?').get(id))
})

router.patch('/skills/:id', async (req, res) => {
  const upd = buildUpdate('rugby_skills', req.params.id, req.body, ['name', 'current_level', 'target_level', 'notes', 'sort_order'])
  if (upd) await db.prepare(upd.sql).run(upd.params)
  res.json(await db.prepare('SELECT * FROM rugby_skills WHERE id = ?').get(req.params.id))
})

router.delete('/skills/:id', async (req, res) => {
  await db.prepare('DELETE FROM rugby_skills WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

export default router
