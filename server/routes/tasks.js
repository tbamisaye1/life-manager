import { Router } from 'express'
import { db } from '../db/index.js'
import { newId, now, buildUpdate } from '../lib/helpers.js'
import { httpError } from '../lib/http.js'
import { touchProject } from '../lib/projects.js'
import { DUE_SORT_KEY_T, normalizeDueDate } from '../lib/dueDate.js'
import { advanceDue, encodeRecurrenceFields, isRecurring, serializeRecurrence } from '../lib/taskRecurrence.js'

const router = Router()
const ALLOWED = ['title', 'status', 'emoji', 'due_date', 'priority', 'recurrence', 'project_id', 'notes', 'is_homework']

const withProject = `
  SELECT t.*, p.short_code AS project_code, p.color AS project_color, p.emoji AS project_emoji
  FROM tasks t LEFT JOIN projects p ON p.id = t.project_id`

function asHomeworkFlag(value) {
  if (value === true || value === 1 || value === '1' || value === 'true') return 1
  return 0
}

// GET /api/tasks?status=&project_id=&filter=overdue|today|week|upcoming
router.get('/', async (req, res) => {
  const rows = await db.prepare(`${withProject} ORDER BY (t.due_date IS NULL), ${DUE_SORT_KEY_T} ASC`).all()
  res.json(rows)
})

router.get('/:id', async (req, res) => {
  const row = await db.prepare(`${withProject} WHERE t.id = ?`).get(req.params.id)
  if (!row) return res.status(404).json(httpError('Task not found', 'NOT_FOUND'))
  res.json(row)
})

router.post('/', async (req, res) => {
  const { title } = req.body
  if (!title?.trim()) return res.status(400).json(httpError('Title is required', 'VALIDATION'))
  const ts = now()
  const id = newId()
  const recurrence = encodeRecurrenceFields(req.body.recurrence, req.body.days_of_week ?? req.body.weekdays)
  await db.prepare(`INSERT INTO tasks (id,title,status,emoji,due_date,priority,recurrence,project_id,notes,is_homework,source,created_at,updated_at)
    VALUES (@id,@title,@status,@emoji,@due_date,@priority,@recurrence,@project_id,@notes,@is_homework,'local',@ts,@ts)`).run({
    id,
    title: title.trim(),
    status: req.body.status || 'todo',
    emoji: req.body.emoji || '📄',
    due_date: normalizeDueDate(req.body.due_date),
    priority: req.body.priority || 'normal',
    recurrence,
    project_id: req.body.project_id || null,
    notes: req.body.notes || '',
    is_homework: asHomeworkFlag(req.body.is_homework),
    ts,
  })
  res.status(201).json(await db.prepare(`${withProject} WHERE t.id = ?`).get(id))
})

router.patch('/:id', async (req, res) => {
  const existing = await db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id)
  if (!existing) return res.status(404).json(httpError('Task not found', 'NOT_FOUND'))
  const patch = { ...req.body }
  if ('is_homework' in patch) patch.is_homework = asHomeworkFlag(patch.is_homework)
  if ('due_date' in patch) patch.due_date = normalizeDueDate(patch.due_date)
  if ('days_of_week' in patch || 'weekdays' in patch || (patch.recurrence && typeof patch.recurrence === 'object')) {
    patch.recurrence = encodeRecurrenceFields(
      patch.recurrence ?? existing.recurrence,
      patch.days_of_week ?? patch.weekdays,
    )
    delete patch.days_of_week
    delete patch.weekdays
  } else if (typeof patch.recurrence === 'string') {
    patch.recurrence = serializeRecurrence(patch.recurrence)
  }
  const isCompleting = patch.status === 'done' && existing.status !== 'done'

  // Completing anything logs work on its project.
  if (isCompleting && existing.project_id) await touchProject(existing.project_id)

  if (isCompleting && isRecurring(existing.recurrence)) {
    // Recurring: roll the due date forward and keep it active instead of
    // marking it done forever, so it reappears next period.
    patch.status = 'todo'
    patch.due_date = advanceDue(existing.due_date, existing.recurrence)
    await db.prepare('UPDATE tasks SET completed_at = NULL WHERE id = ?').run(req.params.id)
  } else if (isCompleting) {
    await db.prepare('UPDATE tasks SET completed_at = ? WHERE id = ?').run(now(), req.params.id)
  } else if (patch.status && patch.status !== 'done') {
    await db.prepare('UPDATE tasks SET completed_at = NULL WHERE id = ?').run(req.params.id)
  }

  const upd = buildUpdate('tasks', req.params.id, patch, ALLOWED)
  if (upd) await db.prepare(upd.sql).run(upd.params)
  res.json(await db.prepare(`${withProject} WHERE t.id = ?`).get(req.params.id))
})

router.delete('/:id', async (req, res) => {
  await db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

export default router
