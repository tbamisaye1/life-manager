import { Router } from 'express'
import { db } from '../db/index.js'
import { newId, now, buildUpdate, decodeBooleans } from '../lib/helpers.js'

const router = Router()
const ALLOWED = ['title', 'cadence', 'emoji', 'sort_order', 'active']
const BOOLS = ['active']

// Each priority reports whether it's "done for its current period" (today for
// daily, this week for weekly) based on last_done_at — powers the checklist.
function decorate(row) {
  if (!row) return row
  const r = decodeBooleans(row, BOOLS)
  r.done_for_period = isDoneForPeriod(row)
  return r
}
function isDoneForPeriod(row) {
  if (!row.last_done_at) return false
  const last = new Date(row.last_done_at)
  const nowD = new Date()
  if (row.cadence === 'weekly') {
    const diff = (nowD - last) / 864e5
    return diff < 7
  }
  return last.toISOString().slice(0, 10) === nowD.toISOString().slice(0, 10)
}

router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM priorities WHERE active = 1 ORDER BY sort_order, created_at').all()
  res.json(rows.map(decorate))
})

router.post('/', (req, res) => {
  const { title } = req.body
  if (!title?.trim()) return res.status(400).json({ error: { message: 'Title required', code: 'VALIDATION' } })
  const ts = now(); const id = newId()
  const max = db.prepare('SELECT COALESCE(MAX(sort_order), -1) m FROM priorities').get().m
  db.prepare(`INSERT INTO priorities (id,title,cadence,emoji,sort_order,active,created_at,updated_at)
    VALUES (@id,@title,@cadence,@emoji,@sort,1,@ts,@ts)`).run({
    id, title: title.trim(), cadence: req.body.cadence || 'daily', emoji: req.body.emoji || '✅', sort: max + 1, ts,
  })
  res.status(201).json(decorate(db.prepare('SELECT * FROM priorities WHERE id = ?').get(id)))
})

// Toggle "done for this period".
router.post('/:id/check', (req, res) => {
  const row = db.prepare('SELECT * FROM priorities WHERE id = ?').get(req.params.id)
  if (!row) return res.status(404).json({ error: { message: 'Not found', code: 'NOT_FOUND' } })
  const newVal = isDoneForPeriod(row) ? null : now()
  db.prepare('UPDATE priorities SET last_done_at = ?, updated_at = ? WHERE id = ?').run(newVal, now(), req.params.id)
  res.json(decorate(db.prepare('SELECT * FROM priorities WHERE id = ?').get(req.params.id)))
})

router.patch('/:id', (req, res) => {
  const upd = buildUpdate('priorities', req.params.id, req.body, ALLOWED)
  if (upd) db.prepare(upd.sql).run(upd.params)
  res.json(decorate(db.prepare('SELECT * FROM priorities WHERE id = ?').get(req.params.id)))
})

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM priorities WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

export default router
