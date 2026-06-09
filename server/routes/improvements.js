import { Router } from 'express'
import { db } from '../db/index.js'
import { newId, now, buildUpdate, decodeBooleans } from '../lib/helpers.js'
import { httpError } from '../lib/http.js'

const router = Router()
const ALLOWED = ['title', 'emoji', 'category', 'summary', 'body', 'why', 'progress']

router.get('/', async (req, res) => {
  const rows = await db.prepare(`
    SELECT i.*,
      (SELECT COUNT(*) FROM improvement_actions a WHERE a.improvement_id = i.id) AS action_count,
      (SELECT COUNT(*) FROM improvement_actions a WHERE a.improvement_id = i.id AND a.done = 1) AS action_done
    FROM improvements i ORDER BY i.created_at`).all()
  res.json(rows)
})

// Each improvement has its own page: returns the point + its action items.
router.get('/:id', async (req, res) => {
  const im = await db.prepare('SELECT * FROM improvements WHERE id = ?').get(req.params.id)
  if (!im) return res.status(404).json(httpError('Not found', 'NOT_FOUND'))
  const actions = (await db.prepare('SELECT * FROM improvement_actions WHERE improvement_id = ? ORDER BY created_at')
    .all(req.params.id)).map((a) => decodeBooleans(a, ['done']))
  res.json({ ...im, actions })
})

router.post('/', async (req, res) => {
  const { title } = req.body
  if (!title?.trim()) return res.status(400).json(httpError('Title required', 'VALIDATION'))
  const ts = now(); const id = newId()
  await db.prepare(`INSERT INTO improvements (id,title,emoji,category,summary,body,why,progress,created_at,updated_at)
    VALUES (@id,@title,@emoji,@category,@summary,@body,@why,@progress,@ts,@ts)`).run({
    id, title: title.trim(), emoji: req.body.emoji || '🎯', category: req.body.category || 'personal',
    summary: req.body.summary || '', body: req.body.body || '', why: req.body.why || '',
    progress: req.body.progress || 0, ts,
  })
  res.status(201).json(await db.prepare('SELECT * FROM improvements WHERE id = ?').get(id))
})

router.patch('/:id', async (req, res) => {
  const upd = buildUpdate('improvements', req.params.id, req.body, ALLOWED)
  if (upd) await db.prepare(upd.sql).run(upd.params)
  res.json(await db.prepare('SELECT * FROM improvements WHERE id = ?').get(req.params.id))
})

router.delete('/:id', async (req, res) => {
  await db.prepare('DELETE FROM improvements WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

// --- Action items under an improvement ---
router.post('/:id/actions', async (req, res) => {
  const { text } = req.body
  if (!text?.trim()) return res.status(400).json(httpError('Text required', 'VALIDATION'))
  const id = newId()
  await db.prepare('INSERT INTO improvement_actions (id,improvement_id,text,done,created_at) VALUES (?,?,?,0,?)')
    .run(id, req.params.id, text.trim(), now())
  res.status(201).json(decodeBooleans(await db.prepare('SELECT * FROM improvement_actions WHERE id = ?').get(id), ['done']))
})

router.patch('/:id/actions/:actionId', async (req, res) => {
  const a = await db.prepare('SELECT * FROM improvement_actions WHERE id = ?').get(req.params.actionId)
  if (!a) return res.status(404).json(httpError('Not found', 'NOT_FOUND'))
  const done = 'done' in req.body ? (req.body.done ? 1 : 0) : a.done
  const text = req.body.text ?? a.text
  await db.prepare('UPDATE improvement_actions SET done = ?, text = ? WHERE id = ?').run(done, text, req.params.actionId)
  res.json(decodeBooleans(await db.prepare('SELECT * FROM improvement_actions WHERE id = ?').get(req.params.actionId), ['done']))
})

router.delete('/:id/actions/:actionId', async (req, res) => {
  await db.prepare('DELETE FROM improvement_actions WHERE id = ?').run(req.params.actionId)
  res.json({ ok: true })
})

export default router
