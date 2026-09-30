import { Router } from 'express'
import { db } from '../db/index.js'
import { newId, now, buildUpdate } from '../lib/helpers.js'
import { httpError } from '../lib/http.js'
import { touchProject } from '../lib/projects.js'
import { DUE_SORT_KEY_T, normalizeDueDate } from '../lib/dueDate.js'
import { advanceDue, encodeRecurrenceFields, isRecurring, serializeRecurrence } from '../lib/taskRecurrence.js'

const router = Router()
const ALLOWED = [
  'title',
  'status',
  'emoji',
  'due_date',
  'priority',
  'recurrence',
  'project_id',
  'notes',
  'is_homework',
  'is_exam',
  'parent_id',
  'sort_order',
]

const withProject = `
  SELECT t.*,
    p.short_code AS project_code, p.color AS project_color, p.emoji AS project_emoji,
    (SELECT COUNT(*)::int FROM tasks c WHERE c.parent_id = t.id) AS subtask_total,
    (SELECT COUNT(*)::int FROM tasks c WHERE c.parent_id = t.id AND c.status = 'done') AS subtask_done
  FROM tasks t LEFT JOIN projects p ON p.id = t.project_id`

function asFlag(value) {
  if (value === true || value === 1 || value === '1' || value === 'true') return 1
  return 0
}

async function nextSortOrder(parentId) {
  const max = (
    await db
      .prepare('SELECT COALESCE(MAX(sort_order), -1) m FROM tasks WHERE parent_id IS NOT DISTINCT FROM @p')
      .get({ p: parentId || null })
  ).m
  return max + 1
}

/** One nesting level only: parent must be a top-level task. */
async function assertValidParent(parentId, selfId = null) {
  if (!parentId) return null
  if (selfId && parentId === selfId) {
    const err = httpError('A task cannot be its own parent', 'VALIDATION')
    err.status = 400
    throw err
  }
  const parent = await db.prepare('SELECT id, parent_id, project_id FROM tasks WHERE id = ?').get(parentId)
  if (!parent) {
    const err = httpError('Parent task not found', 'NOT_FOUND')
    err.status = 404
    throw err
  }
  if (parent.parent_id) {
    const err = httpError('Subtasks cannot have their own subtasks (one level only)', 'VALIDATION')
    err.status = 400
    throw err
  }
  return parent
}

// GET /api/tasks — all rows (parents + children). Clients filter top-level for lists.
router.get('/', async (req, res) => {
  const rows = await db
    .prepare(`${withProject} ORDER BY (t.parent_id IS NOT NULL), (t.due_date IS NULL), ${DUE_SORT_KEY_T} ASC, t.sort_order ASC`)
    .all()
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

  let parent
  try {
    parent = await assertValidParent(req.body.parent_id || null)
  } catch (e) {
    return res.status(e.status || 400).json(e)
  }

  const ts = now()
  const id = newId()
  const recurrence = encodeRecurrenceFields(req.body.recurrence, req.body.days_of_week ?? req.body.weekdays)
  // Subtasks stay out of homework/exam buckets so Tonight / HW views stay clean.
  const isExam = parent ? 0 : asFlag(req.body.is_exam)
  const isHomework = parent ? 0 : asFlag(req.body.is_homework)
  const projectId = req.body.project_id || parent?.project_id || null
  const sortOrder =
    req.body.sort_order != null && Number.isFinite(Number(req.body.sort_order))
      ? Number(req.body.sort_order)
      : await nextSortOrder(parent?.id || null)

  await db
    .prepare(
      `INSERT INTO tasks (id,title,status,emoji,due_date,priority,recurrence,project_id,notes,is_homework,is_exam,parent_id,sort_order,source,created_at,updated_at)
    VALUES (@id,@title,@status,@emoji,@due_date,@priority,@recurrence,@project_id,@notes,@is_homework,@is_exam,@parent_id,@sort_order,'local',@ts,@ts)`,
    )
    .run({
      id,
      title: title.trim(),
      status: req.body.status || 'todo',
      emoji: req.body.emoji || (parent ? null : isExam ? '📝' : isHomework ? '📚' : '📄'),
      due_date: normalizeDueDate(req.body.due_date),
      priority: req.body.priority || 'normal',
      recurrence: parent ? 'single' : recurrence,
      project_id: projectId,
      notes: req.body.notes || '',
      is_homework: isHomework,
      is_exam: isExam,
      parent_id: parent?.id || null,
      sort_order: sortOrder,
      ts,
    })
  res.status(201).json(await db.prepare(`${withProject} WHERE t.id = ?`).get(id))
})

router.patch('/:id', async (req, res) => {
  const existing = await db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id)
  if (!existing) return res.status(404).json(httpError('Task not found', 'NOT_FOUND'))
  const patch = { ...req.body }

  if ('parent_id' in patch) {
    const nextParent = patch.parent_id || null
    if (nextParent) {
      try {
        await assertValidParent(nextParent, req.params.id)
      } catch (e) {
        return res.status(e.status || 400).json(e)
      }
      // Promoting a parent into a subtask would orphan its children — block that.
      const childCount = (
        await db.prepare('SELECT COUNT(*)::int c FROM tasks WHERE parent_id = ?').get(req.params.id)
      ).c
      if (childCount > 0) {
        return res
          .status(400)
          .json(httpError('Move or delete this task\'s subtasks before nesting it under another task', 'VALIDATION'))
      }
    }
    patch.parent_id = nextParent
  }

  if ('is_homework' in patch) patch.is_homework = asFlag(patch.is_homework)
  if ('is_exam' in patch) patch.is_exam = asFlag(patch.is_exam)
  // Subtasks never participate in homework/exam filters.
  if (patch.parent_id || (!('parent_id' in patch) && existing.parent_id)) {
    patch.is_homework = 0
    patch.is_exam = 0
  }
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

  // Recurring roll-forward only applies to top-level tasks.
  if (isCompleting && !existing.parent_id && isRecurring(existing.recurrence)) {
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
