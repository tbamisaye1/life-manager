/**
 * Life Manager remote MCP server (Streamable HTTP).
 *
 * Claude.ai / Cowork / Desktop custom connectors talk to this over HTTPS.
 * Each request gets a fresh McpServer (stateless) — required on Vercel where
 * instances don't share in-memory sessions.
 *
 * Protocol shape (interview version):
 *   Host (Claude)  --JSON-RPC over HTTPS-->  MCP Server (us)
 *   Host lists tools via tools/list, then calls tools/call with args.
 *   We return structured text content Claude can read and act on.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { db } from '../db/index.js'
import { newId, now, localDateStr } from '../lib/helpers.js'

// Qualify with t. — JOINs make bare `id` ambiguous.
const TASK_COLS = `t.id, t.title, t.status, t.emoji, t.due_date, t.priority, t.recurrence, t.project_id, t.notes, t.is_homework, t.completed_at`
const TASK_COLS_PLAIN = `id, title, status, emoji, due_date, priority, recurrence, project_id, notes, is_homework, completed_at`

function jsonResult(data) {
  return {
    content: [{ type: 'text', text: typeof data === 'string' ? data : JSON.stringify(data, null, 2) }],
  }
}

function homeworkFlag(v) {
  return v === true || v === 1 || v === '1' || v === 'true' ? 1 : 0
}

async function resolveProjectId(project) {
  if (!project?.trim()) return null
  const q = project.trim()
  const row = await db
    .prepare(
      `SELECT id FROM projects WHERE archived = 0 AND (short_code ILIKE ? OR name ILIKE ?) ORDER BY updated_at DESC LIMIT 1`,
    )
    .get(q, q)
  if (row) return row.id
  const fuzzy = await db
    .prepare(
      `SELECT id FROM projects WHERE archived = 0 AND (short_code ILIKE ? OR name ILIKE ?) ORDER BY updated_at DESC LIMIT 1`,
    )
    .get(`%${q}%`, `%${q}%`)
  return fuzzy?.id || null
}

async function findTaskByTitle(title, openOnly = false) {
  const words = title.trim().split(/\s+/).filter(Boolean).slice(0, 6)
  const clause = words.map(() => 'title ILIKE ?').join(' AND ') || 'title ILIKE ?'
  const params = words.length ? words.map((w) => `%${w}%`) : [`%${title}%`]
  const guard = openOnly ? "status != 'done' AND " : ''
  return db
    .prepare(`SELECT ${TASK_COLS_PLAIN} FROM tasks WHERE ${guard}${clause} ORDER BY created_at DESC LIMIT 1`)
    .get(...params)
}

function daysUntil(due) {
  if (!due) return null
  const a = new Date(due.slice(0, 10) + 'T12:00:00')
  const b = new Date()
  b.setHours(12, 0, 0, 0)
  return Math.round((a - b) / 86400000)
}

function matchesBucket(task, filter) {
  const d = daysUntil(task.due_date)
  const hw = Number(task.is_homework) === 1
  switch (filter) {
    case 'open':
      return task.status !== 'done'
    case 'done':
      return task.status === 'done'
    case 'all':
      return true
    case 'overdue':
      return task.status !== 'done' && d != null && d < 0
    case 'tonight':
    case 'today':
      return task.status !== 'done' && d === 0
    case 'week':
      return task.status !== 'done' && d != null && d >= 0 && d <= 7
    case 'homework':
      return task.status !== 'done' && hw
    case 'homework_tonight':
      return task.status !== 'done' && hw && d === 0
    case 'homework_week':
      return task.status !== 'done' && hw && d != null && d >= 0 && d <= 7
    default:
      return task.status !== 'done'
  }
}

/** Build a fresh McpServer with Life Manager tools registered. */
export function createLifeManagerMcpServer() {
  const server = new McpServer({
    name: 'life-manager',
    version: '1.0.0',
  })

  server.registerTool(
    'get_today',
    {
      description:
        'Snapshot of today: overdue tasks, due tonight, homework tonight, homework this week, due this week, and today\'s events. Prefer this for "what do I have tonight / this week?".',
      inputSchema: {},
    },
    async () => {
      const today = localDateStr()
      const rows = await db
        .prepare(
          `SELECT ${TASK_COLS}, p.short_code AS project_code
           FROM tasks t LEFT JOIN projects p ON p.id = t.project_id
           WHERE t.status != 'done' ORDER BY (t.due_date IS NULL), t.due_date`,
        )
        .all()
      const events = await db
        .prepare(
          `SELECT id, title, start, "end", all_day, location FROM events WHERE substr(start,1,10) = ? ORDER BY all_day DESC, start`,
        )
        .all(today)

      const overdue = rows.filter((t) => matchesBucket(t, 'overdue'))
      const tonight = rows.filter((t) => matchesBucket(t, 'tonight'))
      const week = rows.filter((t) => matchesBucket(t, 'week'))
      const homeworkTonight = rows.filter((t) => matchesBucket(t, 'homework_tonight'))
      const homeworkWeek = rows.filter((t) => matchesBucket(t, 'homework_week'))

      return jsonResult({
        date: today,
        overdue,
        tonight,
        due_this_week: week,
        homework_tonight: homeworkTonight,
        homework_this_week: homeworkWeek,
        events,
        counts: {
          overdue: overdue.length,
          tonight: tonight.length,
          due_this_week: week.length,
          homework_tonight: homeworkTonight.length,
          homework_this_week: homeworkWeek.length,
          events: events.length,
        },
      })
    },
  )

  server.registerTool(
    'list_tasks',
    {
      description:
        'List tasks with a filter. Filters: open, done, all, overdue, tonight, week, homework, homework_tonight, homework_week.',
      inputSchema: {
        filter: z
          .enum([
            'open',
            'done',
            'all',
            'overdue',
            'tonight',
            'today',
            'week',
            'homework',
            'homework_tonight',
            'homework_week',
          ])
          .optional()
          .describe('defaults to open'),
        limit: z.number().int().min(1).max(100).optional().describe('max rows, default 40'),
      },
    },
    async ({ filter = 'open', limit = 40 }) => {
      const rows = await db
        .prepare(
          `SELECT ${TASK_COLS}, p.short_code AS project_code
           FROM tasks t LEFT JOIN projects p ON p.id = t.project_id
           ORDER BY (t.due_date IS NULL), t.due_date`,
        )
        .all()
      const tasks = rows.filter((t) => matchesBucket(t, filter)).slice(0, limit)
      return jsonResult({ filter, count: tasks.length, tasks })
    },
  )

  server.registerTool(
    'create_task',
    {
      description:
        'Create a task. Set is_homework=true for school assignments so they show in Homework Tonight / This week.',
      inputSchema: {
        title: z.string(),
        due_date: z.string().optional().describe('YYYY-MM-DD or local datetime'),
        priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
        project: z.string().optional().describe('project name or short_code'),
        notes: z.string().optional(),
        is_homework: z.boolean().optional(),
        recurrence: z.enum(['single', 'daily', 'weekly', 'monthly']).optional(),
        emoji: z.string().optional(),
      },
    },
    async ({ title, due_date, priority, project, notes, is_homework, recurrence, emoji }) => {
      const ts = now()
      const id = newId()
      const projectId = await resolveProjectId(project)
      await db
        .prepare(
          `INSERT INTO tasks (id,title,status,emoji,due_date,priority,recurrence,project_id,notes,is_homework,source,created_at,updated_at)
           VALUES (@id,@title,'todo',@emoji,@due,@priority,@recurrence,@pid,@notes,@hw,'mcp',@ts,@ts)`,
        )
        .run({
          id,
          title: title.trim(),
          emoji: emoji || (is_homework ? '📚' : '📌'),
          due: due_date || null,
          priority: priority || 'normal',
          recurrence: recurrence || 'single',
          pid: projectId,
          notes: notes || '',
          hw: homeworkFlag(is_homework),
          ts,
        })
      return jsonResult({
        ok: true,
        id,
        title: title.trim(),
        due_date: due_date || null,
        is_homework: !!homeworkFlag(is_homework),
      })
    },
  )

  server.registerTool(
    'update_task',
    {
      description:
        'Update a task found by title fragment (or by id). Can rename, change due date, priority, notes, homework flag, status, project.',
      inputSchema: {
        title: z.string().optional().describe('title fragment to find the task'),
        id: z.string().optional().describe('task id if known'),
        new_title: z.string().optional(),
        due_date: z.string().optional(),
        priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
        status: z.enum(['todo', 'doing', 'done']).optional(),
        notes: z.string().optional(),
        is_homework: z.boolean().optional(),
        project: z.string().optional().describe('project name/short_code; empty string clears'),
      },
    },
    async (args) => {
      let task = null
      if (args.id) task = await db.prepare(`SELECT ${TASK_COLS_PLAIN} FROM tasks WHERE id = ?`).get(args.id)
      else if (args.title) task = await findTaskByTitle(args.title, false)
      if (!task) return jsonResult({ ok: false, message: 'Task not found. Pass id or a title fragment.' })

      const sets = []
      const p = { id: task.id, ts: now() }
      if (args.new_title) {
        sets.push('title = @title')
        p.title = args.new_title
      }
      if (args.due_date !== undefined) {
        sets.push('due_date = @due')
        p.due = args.due_date || null
      }
      if (args.priority) {
        sets.push('priority = @priority')
        p.priority = args.priority
      }
      if (args.status) {
        sets.push('status = @status')
        p.status = args.status
        if (args.status === 'done') sets.push('completed_at = @ts')
        else sets.push('completed_at = NULL')
      }
      if (args.notes !== undefined) {
        sets.push('notes = @notes')
        p.notes = args.notes
      }
      if (args.is_homework !== undefined) {
        sets.push('is_homework = @hw')
        p.hw = homeworkFlag(args.is_homework)
      }
      if (args.project !== undefined) {
        sets.push('project_id = @pid')
        p.pid = args.project === '' ? null : await resolveProjectId(args.project)
      }
      if (!sets.length) return jsonResult({ ok: false, message: 'Nothing to update.' })
      await db.prepare(`UPDATE tasks SET ${sets.join(', ')}, updated_at = @ts WHERE id = @id`).run(p)
      return jsonResult({ ok: true, id: task.id, title: args.new_title || task.title })
    },
  )

  server.registerTool(
    'complete_task',
    {
      description: 'Mark an open task done (by title fragment or id).',
      inputSchema: {
        title: z.string().optional(),
        id: z.string().optional(),
      },
    },
    async ({ title, id }) => {
      let task = null
      if (id) task = await db.prepare(`SELECT ${TASK_COLS_PLAIN} FROM tasks WHERE id = ?`).get(id)
      else if (title) task = await findTaskByTitle(title, true)
      if (!task) return jsonResult({ ok: false, message: 'Open task not found.' })
      await db
        .prepare(`UPDATE tasks SET status = 'done', completed_at = @ts, updated_at = @ts WHERE id = @id`)
        .run({ id: task.id, ts: now() })
      return jsonResult({ ok: true, id: task.id, title: task.title })
    },
  )

  server.registerTool(
    'delete_task',
    {
      description: 'Delete a task by title fragment or id.',
      inputSchema: {
        title: z.string().optional(),
        id: z.string().optional(),
      },
    },
    async ({ title, id }) => {
      let task = null
      if (id) task = await db.prepare(`SELECT ${TASK_COLS_PLAIN} FROM tasks WHERE id = ?`).get(id)
      else if (title) task = await findTaskByTitle(title, false)
      if (!task) return jsonResult({ ok: false, message: 'Task not found.' })
      await db.prepare('DELETE FROM tasks WHERE id = ?').run(task.id)
      return jsonResult({ ok: true, id: task.id, title: task.title })
    },
  )

  server.registerTool(
    'list_projects',
    {
      description: 'List active projects (id, name, short_code) for attaching tasks.',
      inputSchema: {},
    },
    async () => {
      const projects = await db
        .prepare(
          `SELECT id, name, short_code, emoji, color FROM projects WHERE archived = 0 ORDER BY last_worked_at DESC NULLS LAST, name`,
        )
        .all()
      return jsonResult({ count: projects.length, projects })
    },
  )

  server.registerTool(
    'get_schedule',
    {
      description: 'List calendar events for a day (default today).',
      inputSchema: {
        date: z.string().optional().describe('YYYY-MM-DD; omit for today'),
      },
    },
    async ({ date }) => {
      const day = date || localDateStr()
      const events = await db
        .prepare(
          `SELECT id, title, start, "end", all_day, location, notes, flagship, source
           FROM events WHERE substr(start,1,10) = ? ORDER BY all_day DESC, start`,
        )
        .all(day)
      return jsonResult({ date: day, count: events.length, events })
    },
  )

  server.registerTool(
    'search',
    {
      description: 'Quick text search across tasks and events by title fragment.',
      inputSchema: {
        query: z.string().describe('search text'),
        limit: z.number().int().min(1).max(50).optional(),
      },
    },
    async ({ query, limit = 20 }) => {
      const q = `%${query.trim()}%`
      const tasks = await db
        .prepare(
          `SELECT id, title, status, due_date, is_homework FROM tasks WHERE title ILIKE ? OR notes ILIKE ? ORDER BY updated_at DESC LIMIT ?`,
        )
        .all(q, q, limit)
      const events = await db
        .prepare(
          `SELECT id, title, start, "end" FROM events WHERE title ILIKE ? OR notes ILIKE ? ORDER BY start DESC LIMIT ?`,
        )
        .all(q, q, limit)
      return jsonResult({ query, tasks, events })
    },
  )

  return server
}
