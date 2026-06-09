import { Router } from 'express'
import { db } from '../db/index.js'
import { buildUpdate, mapRows, decodeBooleans } from '../lib/helpers.js'
import { httpError } from '../lib/http.js'

const router = Router()
const ALLOWED = ['is_read', 'pinned', 'reply_note', 'needs_reply', 'project_id']
const BOOLS = ['is_read', 'pinned', 'needs_reply']

// GET /api/emails?filter=pinned|needs_reply|unread
router.get('/', (req, res) => {
  const { filter } = req.query
  let where = ''
  if (filter === 'pinned') where = 'WHERE pinned = 1'
  else if (filter === 'needs_reply') where = 'WHERE needs_reply = 1'
  else if (filter === 'unread') where = 'WHERE is_read = 0'
  const rows = db.prepare(`SELECT * FROM emails ${where} ORDER BY pinned DESC, received_at DESC`).all()
  res.json(mapRows(rows, BOOLS))
})

router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM emails WHERE id = ?').get(req.params.id)
  if (!row) return res.status(404).json(httpError('Not found', 'NOT_FOUND'))
  res.json(decodeBooleans(row, BOOLS))
})

router.patch('/:id', (req, res) => {
  const patch = { ...req.body }
  for (const b of BOOLS) if (b in patch) patch[b] = patch[b] ? 1 : 0
  const upd = buildUpdate('emails', req.params.id, patch, ALLOWED)
  if (upd) db.prepare(upd.sql).run(upd.params)
  res.json(decodeBooleans(db.prepare('SELECT * FROM emails WHERE id = ?').get(req.params.id), BOOLS))
})

export default router
