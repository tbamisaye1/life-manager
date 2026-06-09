import { Router } from 'express'
import { db } from '../db/index.js'
import { newId, now, buildUpdate, mapRows, decodeBooleans } from '../lib/helpers.js'
import { httpError } from '../lib/http.js'

const router = Router()
const ALLOWED = ['title', 'start', 'end', 'all_day', 'location', 'notes', 'color', 'project_id', 'flagship']
const BOOLS = ['all_day', 'flagship']

// GET /api/events?from=ISO&to=ISO&flagship=1
//  - date-only `to` is treated as end-of-day so timed events on the final day
//    aren't lexically excluded
//  - flagship=1 returns only month-Calendar events (the daily schedule omits it
//    to show everything)
router.get('/', async (req, res) => {
  const { from, to, flagship } = req.query
  const where = []
  const params = {}
  if (from && to) {
    where.push('start >= @from AND start <= @to')
    params.from = from
    params.to = to.length <= 10 ? `${to}T23:59:59.999Z` : to
  }
  if (flagship === '1') where.push('flagship = 1')
  const sql = `SELECT * FROM events${where.length ? ` WHERE ${where.join(' AND ')}` : ''} ORDER BY start ASC`
  res.json(mapRows(await db.prepare(sql).all(params), BOOLS))
})

router.get('/:id', async (req, res) => {
  const row = await db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id)
  if (!row) return res.status(404).json(httpError('Event not found', 'NOT_FOUND'))
  res.json(decodeBooleans(row, BOOLS))
})

router.post('/', async (req, res) => {
  const { title, start } = req.body
  if (!title?.trim() || !start) return res.status(400).json(httpError('title and start are required', 'VALIDATION'))
  const ts = now()
  const id = newId()
  await db.prepare(`INSERT INTO events (id,title,start,"end",all_day,location,notes,color,flagship,project_id,source,created_at,updated_at)
    VALUES (@id,@title,@start,@end,@all_day,@location,@notes,@color,@flagship,@project_id,'local',@ts,@ts)`).run({
    id, title: title.trim(), start, end: req.body.end || start,
    all_day: req.body.all_day ? 1 : 0, location: req.body.location || '',
    notes: req.body.notes || '', color: req.body.color || 'slate',
    flagship: req.body.flagship === false || req.body.flagship === 0 ? 0 : 1,
    project_id: req.body.project_id || null, ts,
  })
  res.status(201).json(decodeBooleans(await db.prepare('SELECT * FROM events WHERE id = ?').get(id), BOOLS))
})

router.patch('/:id', async (req, res) => {
  const patch = { ...req.body }
  if ('all_day' in patch) patch.all_day = patch.all_day ? 1 : 0
  if ('flagship' in patch) patch.flagship = patch.flagship ? 1 : 0
  const upd = buildUpdate('events', req.params.id, patch, ALLOWED)
  if (upd) await db.prepare(upd.sql).run(upd.params)
  res.json(decodeBooleans(await db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id), BOOLS))
})

router.delete('/:id', async (req, res) => {
  await db.prepare('DELETE FROM events WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

export default router
