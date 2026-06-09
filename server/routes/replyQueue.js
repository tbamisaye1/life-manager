import { Router } from 'express'
import { db } from '../db/index.js'
import { newId, now, buildUpdate, mapRows, decodeBooleans } from '../lib/helpers.js'

const router = Router()
const ALLOWED = ['person', 'platform', 'context', 'due_date', 'done']
const BOOLS = ['done']

router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM reply_queue ORDER BY done ASC, (due_date IS NULL), due_date ASC').all()
  res.json(mapRows(rows, BOOLS))
})

router.post('/', (req, res) => {
  const { person } = req.body
  if (!person?.trim()) return res.status(400).json({ error: { message: 'Person required', code: 'VALIDATION' } })
  const ts = now(); const id = newId()
  db.prepare(`INSERT INTO reply_queue (id,person,platform,context,due_date,done,created_at,updated_at)
    VALUES (@id,@person,@platform,@context,@due,0,@ts,@ts)`).run({
    id, person: person.trim(), platform: req.body.platform || 'imessage',
    context: req.body.context || '', due: req.body.due_date || null, ts,
  })
  res.status(201).json(decodeBooleans(db.prepare('SELECT * FROM reply_queue WHERE id = ?').get(id), BOOLS))
})

router.patch('/:id', (req, res) => {
  const patch = { ...req.body }
  if ('done' in patch) patch.done = patch.done ? 1 : 0
  const upd = buildUpdate('reply_queue', req.params.id, patch, ALLOWED)
  if (upd) db.prepare(upd.sql).run(upd.params)
  res.json(decodeBooleans(db.prepare('SELECT * FROM reply_queue WHERE id = ?').get(req.params.id), BOOLS))
})

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM reply_queue WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

export default router
