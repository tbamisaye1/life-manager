import { tool } from '@langchain/core/tools'
import { z } from 'zod'
import { db } from '../../db/index.js'
import { newId, now, localDateStr } from '../helpers.js'

// We work in local wall-clock time throughout — "3pm" means 3pm to the user.
const pad = (n) => String(n).padStart(2, '0')
const minutesToIso = (date, mins) => `${date}T${pad(Math.floor(mins / 60))}:${pad(mins % 60)}:00`
const minutesIntoDay = (iso) => { const d = new Date(iso); return d.getHours() * 60 + d.getMinutes() }
const addMinutes = (iso, mins) => {
  const d = new Date(iso)
  d.setMinutes(d.getMinutes() + mins)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`
}

// Look for the first open gap of `duration` minutes on a day, scanning that
// day's timed events between the earliest/latest bounds.
// Parse "HH:mm" to minutes, falling back to a default if malformed.
const parseClock = (value, fallback) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value || '')
  return m ? Number(m[1]) * 60 + Number(m[2]) : fallback
}

async function firstFreeSlot(date, duration, earliest, latest) {
  const dayEnd = parseClock(latest, 22 * 60)
  let cursor = parseClock(earliest, 8 * 60)

  const events = await db
    .prepare('SELECT start, "end" FROM events WHERE all_day = 0 AND substr(start,1,10) = ? ORDER BY start')
    .all(date)
  const busy = events
    .map((e) => {
      const start = minutesIntoDay(e.start)
      // An end on a later day (or missing) clamps to end-of-day so it still blocks time.
      let end = e.end ? minutesIntoDay(e.end) : start + 60
      if (end <= start) end = 24 * 60
      return { start, end }
    })
    .sort((a, b) => a.start - b.start)

  for (const block of busy) {
    if (block.start - cursor >= duration) break
    if (block.end > cursor) cursor = block.end
  }
  if (cursor + duration > dayEnd) return null
  return { start: minutesToIso(date, cursor), end: minutesToIso(date, cursor + duration) }
}

async function resolveProjectId(name) {
  if (!name) return null
  const row = await db
    .prepare('SELECT id FROM projects WHERE name ILIKE ? OR short_code ILIKE ? LIMIT 1')
    .get(`%${name}%`, `%${name}%`)
  return row?.id ?? null
}

/**
 * Build the agent's toolset. Each tool that changes something calls `record`
 * with a short human-readable line, which the UI shows as a confirmation chip.
 */
export function buildTools(record) {
  const getSchedule = tool(
    async ({ date }) => {
      const day = date || localDateStr()
      const events = await db
        .prepare('SELECT id, title, start, "end", all_day FROM events WHERE substr(start,1,10) = ? ORDER BY all_day DESC, start')
        .all(day)
      // Include ids so the model can delete/move specific events.
      return JSON.stringify({ date: day, events })
    },
    {
      name: 'get_schedule',
      description: "Look at the user's events/blocks for a day (defaults to today). Returns each event's id so you can delete or move it. Check this before scheduling, clearing, or rescheduling.",
      schema: z.object({ date: z.string().optional().describe('YYYY-MM-DD; omit for today') }),
    },
  )

  const findFreeSlot = tool(
    async ({ duration_minutes, date, earliest, latest }) => {
      const day = date || localDateStr()
      const slot = await firstFreeSlot(day, duration_minutes || 60, earliest || '08:00', latest || '22:00')
      return JSON.stringify(slot ? { date: day, ...slot } : { date: day, free: false })
    },
    {
      name: 'find_free_slot',
      description: 'Find the first free block of a given length on a day, within optional earliest/latest bounds.',
      schema: z.object({
        duration_minutes: z.number().int().describe('length of the block in minutes'),
        date: z.string().optional(),
        earliest: z.string().optional().describe('HH:mm, default 08:00'),
        latest: z.string().optional().describe('HH:mm, default 22:00'),
      }),
    },
  )

  const scheduleEvent = tool(
    async ({ title, start, end, duration_minutes, all_day }) => {
      const ts = now()
      const id = newId()
      const finish = end || (all_day ? start : addMinutes(start, duration_minutes || 60))
      // flagship=0: assistant blocks live on the daily schedule, not the month
      // Calendar overview (which is reserved for flagship events).
      await db
        .prepare(`INSERT INTO events (id,title,start,"end",all_day,location,notes,color,flagship,source,created_at,updated_at)
          VALUES (@id,@title,@start,@end,@all_day,'','','blue',0,'assistant',@ts,@ts)`)
        .run({ id, title, start, end: finish, all_day: all_day ? 1 : 0, ts })
      record(`📅 Scheduled “${title}”`)
      return JSON.stringify({ ok: true, id, title, start, end: finish })
    },
    {
      name: 'schedule_event',
      description: 'Put a timed block on the daily schedule.',
      schema: z.object({
        title: z.string(),
        start: z.string().describe('local datetime, e.g. 2026-06-09T13:00:00'),
        end: z.string().optional(),
        duration_minutes: z.number().int().optional(),
        all_day: z.boolean().optional(),
      }),
    },
  )

  const createTask = tool(
    async ({ title, due_date, priority, project }) => {
      const ts = now()
      const id = newId()
      const projectId = await resolveProjectId(project)
      await db
        .prepare(`INSERT INTO tasks (id,title,status,emoji,due_date,priority,recurrence,project_id,notes,source,created_at,updated_at)
          VALUES (@id,@title,'todo','📌',@due,@priority,'single',@pid,'','assistant',@ts,@ts)`)
        .run({ id, title, due: due_date || null, priority: priority || 'normal', pid: projectId, ts })
      record(`✅ Added task “${title}”${priority && priority !== 'normal' ? ` (${priority})` : ''}`)
      return JSON.stringify({ ok: true, id, title, priority: priority || 'normal' })
    },
    {
      name: 'create_task',
      description: 'Create a task or reminder. Set a due_date when a time is implied, and priority if it sounds urgent.',
      schema: z.object({
        title: z.string(),
        due_date: z.string().optional().describe('local datetime; optional'),
        priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
        project: z.string().optional().describe('project name to attach to, if mentioned'),
      }),
    },
  )

  const setTaskPriority = tool(
    async ({ title, priority }) => {
      // Match a task that contains all of the given words, in any order.
      const words = title.trim().split(/\s+/).filter(Boolean).slice(0, 6)
      const where = words.map(() => 'title ILIKE ?').join(' AND ') || 'title ILIKE ?'
      const params = words.length ? words.map((w) => `%${w}%`) : [`%${title}%`]
      const task = await db
        .prepare(`SELECT id, title FROM tasks WHERE status != 'done' AND ${where} ORDER BY created_at DESC LIMIT 1`)
        .get(...params)
      if (!task) return JSON.stringify({ ok: false, message: `No open task matching "${title}".` })
      await db.prepare('UPDATE tasks SET priority = ?, updated_at = ? WHERE id = ?').run(priority, now(), task.id)
      record(`⚡ Set “${task.title}” to ${priority}`)
      return JSON.stringify({ ok: true, id: task.id, title: task.title, priority })
    },
    {
      name: 'set_task_priority',
      description: 'Change the priority of an existing open task, found by a fragment of its title.',
      schema: z.object({
        title: z.string().describe('part of the task title'),
        priority: z.enum(['low', 'normal', 'high', 'urgent']),
      }),
    },
  )

  const addToBoredList = tool(
    async ({ title, category }) => {
      const ts = now()
      const id = newId()
      const max = (await db.prepare('SELECT COALESCE(MAX(sort_order), -1) m FROM bored_items').get()).m
      await db
        .prepare(`INSERT INTO bored_items (id,title,emoji,category,body,done,sort_order,created_at,updated_at)
          VALUES (@id,@title,'💡',@category,'',0,@ord,@ts,@ts)`)
        .run({ id, title, category: category || 'other', ord: Number(max) + 1, ts })
      record(`💡 Added “${title}” to your Bored list`)
      return JSON.stringify({ ok: true, id, title })
    },
    {
      name: 'add_to_bored_list',
      description: "Add something to the user's 'I'm Bored' list to come back to later.",
      schema: z.object({
        title: z.string(),
        category: z.enum(['learn', 'project', 'improve', 'fun', 'other']).optional(),
      }),
    },
  )

  const deleteEvent = tool(
    async ({ event_id }) => {
      const ev = await db.prepare('SELECT id, title FROM events WHERE id = ?').get(event_id)
      if (!ev) return JSON.stringify({ ok: false, message: 'No event with that id.' })
      await db.prepare('DELETE FROM events WHERE id = ?').run(event_id)
      record(`🗑️ Removed “${ev.title}”`)
      return JSON.stringify({ ok: true, id: event_id })
    },
    {
      name: 'delete_event',
      description: 'Delete a single event by its id (get ids from get_schedule first). Do NOT re-create events to "clear" them.',
      schema: z.object({ event_id: z.string() }),
    },
  )

  const clearDay = tool(
    async ({ date, include_all_day }) => {
      const day = date || localDateStr()
      const filter = include_all_day ? '' : ' AND all_day = 0'
      const rows = await db.prepare(`SELECT id FROM events WHERE substr(start,1,10) = ?${filter}`).all(day)
      for (const r of rows) await db.prepare('DELETE FROM events WHERE id = ?').run(r.id)
      record(`🗑️ Cleared ${rows.length} event${rows.length === 1 ? '' : 's'} on ${day}`)
      return JSON.stringify({ ok: true, date: day, deleted: rows.length })
    },
    {
      name: 'clear_day',
      description: "Remove ALL of a day's events at once (timed only by default; set include_all_day to also remove all-day events). Use this for 'clear my schedule' requests.",
      schema: z.object({ date: z.string().optional(), include_all_day: z.boolean().optional() }),
    },
  )

  const rescheduleEvent = tool(
    async ({ event_id, start, end }) => {
      const ev = await db.prepare('SELECT id, title FROM events WHERE id = ?').get(event_id)
      if (!ev) return JSON.stringify({ ok: false, message: 'No event with that id.' })
      await db.prepare('UPDATE events SET start = ?, "end" = ?, updated_at = ? WHERE id = ?').run(start, end || start, now(), event_id)
      record(`🕑 Moved “${ev.title}”`)
      return JSON.stringify({ ok: true, id: event_id, start, end: end || start })
    },
    {
      name: 'reschedule_event',
      description: 'Move an existing event to a new start/end (ids from get_schedule). Use this to move things — never delete + recreate.',
      schema: z.object({ event_id: z.string(), start: z.string(), end: z.string().optional() }),
    },
  )

  return [getSchedule, findFreeSlot, scheduleEvent, deleteEvent, clearDay, rescheduleEvent, createTask, setTaskPriority, addToBoredList]
}
