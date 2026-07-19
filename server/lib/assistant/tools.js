import { tool } from '@langchain/core/tools'
import { z } from 'zod'
import { db } from '../../db/index.js'
import { newId, now, localDateStr } from '../helpers.js'
import { firstFreeSlot, addMinutes, resolveProjectId, findEvents, removeEventById } from './tools-shared.js'
import { expandRecurrence } from '../recurrence.js'
import * as googleI from '../../integrations/google.js'
import * as microsoftI from '../../integrations/microsoft.js'
import { buildGymTools } from './tools-gym.js'
import { buildNotesTools } from './tools-notes.js'
import { buildRugbyTools } from './tools-rugby.js'
import { buildProjectTools } from './tools-projects.js'
import { buildListTools } from './tools-lists.js'
import { buildInboxTools } from './tools-inbox.js'
import { buildPinsTools } from './tools-pins.js'

/**
 * Build the agent's full toolset. Each tool that changes something calls
 * `record` with a short human-readable line, which the UI shows as a chip.
 * Schedule + task tools live here; the rest are grouped into domain modules.
 */
export function buildTools(record) {
  const getSchedule = tool(
    async ({ date }) => {
      const day = date || localDateStr()
      const events = await db
        .prepare('SELECT id, title, start, "end", all_day, flagship, source, series_id FROM events WHERE substr(start,1,10) = ? ORDER BY all_day DESC, start')
        .all(day)
      // Include ids (and series_id for recurring) so the model can move/delete.
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

  const isLocalOnly = (calendar) => calendar && /^(local|app|life ?manager|none|just (the )?app)$/i.test(calendar.trim())

  const scheduleEvent = tool(
    async ({ title, start, end, duration_minutes, all_day, location, notes, color, flagship, project, calendar }) => {
      const finish = end || (all_day ? start : addMinutes(start, duration_minutes || 60))

      // Month-calendar (flagship) events must stay app-local — Google sync clears flagship.
      if (flagship) calendar = 'local'

      // Default: Google calendar if connected, else Microsoft, else local.
      if (!isLocalOnly(calendar)) {
        let target = null
        let provider = null
        try {
          target = await googleI.resolveCalendarTarget(calendar)
          if (target) provider = 'google'
        } catch { /* fall through */ }
        if (!target) {
          try {
            target = await microsoftI.resolveCalendarTarget(calendar)
            if (target) provider = 'microsoft'
          } catch { /* fall through */ }
        }
        if (target && provider === 'google') {
          const ev = await googleI.createEvent({
            email: target.email, calendarId: target.calendarId, title,
            start, end: finish, allDay: !!all_day, location, notes,
          })
          record(`📅 Scheduled “${title}” on ${target.email}`)
          return JSON.stringify({ ok: true, id: ev.id, calendar: target.email, start, end: finish })
        }
        if (target && provider === 'microsoft') {
          const ev = await microsoftI.createEvent({
            email: target.email, calendarId: target.calendarId, title,
            start, end: finish, allDay: !!all_day, location, notes,
          })
          record(`📅 Scheduled “${title}” on ${target.email}`)
          return JSON.stringify({ ok: true, id: ev.id, calendar: target.email, start, end: finish })
        }
        if (calendar) return JSON.stringify({ ok: false, message: `No connected calendar matching “${calendar}”. Try a Google/Outlook calendar name, or say "local".` })
      }

      const ts = now()
      const id = newId()
      const projectId = await resolveProjectId(project)
      await db
        .prepare(`INSERT INTO events (id,title,start,"end",all_day,location,notes,color,flagship,project_id,source,created_at,updated_at)
          VALUES (@id,@title,@start,@end,@all_day,@location,@notes,@color,@flagship,@pid,'assistant',@ts,@ts)`)
        .run({
          id, title, start, end: finish, all_day: all_day ? 1 : 0,
          location: location || '', notes: notes || '', color: color || 'blue',
          flagship: flagship ? 1 : 0, pid: projectId, ts,
        })
      record(`📅 Scheduled “${title}” (app only)`)
      return JSON.stringify({ ok: true, id, title, start, end: finish, calendar: 'local' })
    },
    {
      name: 'schedule_event',
      description: 'Create an event. By DEFAULT it goes on the default Google calendar (Yahoo) and also appears in the app schedule. Pass calendar="yale"/"rotunda"/"yahoo" (or a calendar name) to target another; pass calendar="local" to keep it only in the app. Set flagship=true for a month-calendar overview event — this ALWAYS stays app-local (never Google).',
      schema: z.object({
        title: z.string(),
        calendar: z.string().optional().describe('Where to put it: omit for default (Yahoo); "yale"/"rotunda"/"yahoo"/a calendar name; or "local" for app-only.'),
        start: z.string().describe('local datetime, e.g. 2026-06-09T13:00:00'),
        end: z.string().optional(),
        duration_minutes: z.number().int().optional(),
        all_day: z.boolean().optional(),
        location: z.string().optional(),
        notes: z.string().optional(),
        color: z.enum(['blue', 'violet', 'emerald', 'amber', 'rose', 'orange', 'teal', 'slate', 'red']).optional(),
        flagship: z.boolean().optional().describe('true = big overview/month-calendar event'),
        project: z.string().optional().describe('project name/short_code to attach'),
      }),
    },
  )

  const updateEvent = tool(
    async ({ event_id, title, start, end, all_day, location, notes, color, flagship }) => {
      const ev = await db.prepare('SELECT * FROM events WHERE id = ?').get(event_id)
      if (!ev) return JSON.stringify({ ok: false, message: 'No event with that id (use find_events first).' })
      const patch = {}
      if (title !== undefined) patch.title = title
      if (start !== undefined) patch.start = start
      if (end !== undefined) patch.end = end
      if (all_day !== undefined) patch.all_day = all_day ? 1 : 0
      if (location !== undefined) patch.location = location
      if (notes !== undefined) patch.notes = notes
      if (color !== undefined) patch.color = color
      if (flagship !== undefined) patch.flagship = flagship ? 1 : 0
      if (!Object.keys(patch).length) return JSON.stringify({ ok: false, message: 'Nothing to update.' })
      if (ev.source === 'google') {
        try { await googleI.pushUpdate(ev, patch) } catch (err) {
          return JSON.stringify({ ok: false, message: `Couldn't update on Google: ${err.message}` })
        }
      }
      if (ev.source === 'microsoft') {
        try { await microsoftI.pushUpdate(ev, patch) } catch (err) {
          return JSON.stringify({ ok: false, message: `Couldn't update on Outlook: ${err.message}` })
        }
      }
      const sets = []
      const p = { id: event_id, ts: now() }
      if (title !== undefined) { sets.push('title = @title'); p.title = title }
      if (start !== undefined) { sets.push('start = @start'); p.start = start }
      if (end !== undefined) { sets.push('"end" = @end'); p.end = end }
      if (all_day !== undefined) { sets.push('all_day = @all_day'); p.all_day = all_day ? 1 : 0 }
      if (location !== undefined) { sets.push('location = @location'); p.location = location }
      if (notes !== undefined) { sets.push('notes = @notes'); p.notes = notes }
      if (color !== undefined) { sets.push('color = @color'); p.color = color }
      if (flagship !== undefined) { sets.push('flagship = @flagship'); p.flagship = flagship ? 1 : 0 }
      await db.prepare(`UPDATE events SET ${sets.join(', ')}, updated_at = @ts WHERE id = @id`).run(p)
      record(`✏️ Updated “${title || ev.title}”`)
      return JSON.stringify({ ok: true, id: event_id })
    },
    {
      name: 'update_event',
      description: "Edit an existing event's details (ids from find_events): rename, change time, location, notes, colour, all-day, or flagship status. To only move the time, reschedule_event is simpler.",
      schema: z.object({
        event_id: z.string(),
        title: z.string().optional(),
        start: z.string().optional(),
        end: z.string().optional(),
        all_day: z.boolean().optional(),
        location: z.string().optional(),
        notes: z.string().optional(),
        color: z.enum(['blue', 'violet', 'emerald', 'amber', 'rose', 'orange', 'teal', 'slate', 'red']).optional(),
        flagship: z.boolean().optional(),
      }),
    },
  )

  const createTask = tool(
    async ({ title, due_date, priority, project, notes, recurrence, emoji }) => {
      const ts = now()
      const id = newId()
      const projectId = await resolveProjectId(project)
      await db
        .prepare(`INSERT INTO tasks (id,title,status,emoji,due_date,priority,recurrence,project_id,notes,source,created_at,updated_at)
          VALUES (@id,@title,'todo',@emoji,@due,@priority,@recurrence,@pid,@notes,'assistant',@ts,@ts)`)
        .run({
          id, title, emoji: emoji || '📌', due: due_date || null,
          priority: priority || 'normal', recurrence: recurrence || 'single',
          pid: projectId, notes: notes || '', ts,
        })
      record(`✅ Added task “${title}”${priority && priority !== 'normal' ? ` (${priority})` : ''}`)
      return JSON.stringify({ ok: true, id, title, priority: priority || 'normal' })
    },
    {
      name: 'create_task',
      description: 'Create a task or reminder. Set a due_date when a time is implied, priority if it sounds urgent, notes for any detail/description, and recurrence if it repeats.',
      schema: z.object({
        title: z.string(),
        due_date: z.string().optional().describe('local datetime; optional'),
        priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
        project: z.string().optional().describe('project name to attach to, if mentioned'),
        notes: z.string().optional().describe('description / extra detail'),
        recurrence: z.enum(['single', 'daily', 'weekly', 'monthly', 'yearly']).optional(),
        emoji: z.string().optional(),
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

  // Shared title-fragment matcher: find one task whose title contains all words.
  const findTask = (title, openOnly) => {
    const words = title.trim().split(/\s+/).filter(Boolean).slice(0, 6)
    const clause = words.map(() => 'title ILIKE ?').join(' AND ') || 'title ILIKE ?'
    const params = words.length ? words.map((w) => `%${w}%`) : [`%${title}%`]
    const guard = openOnly ? "status != 'done' AND " : ''
    return db.prepare(`SELECT id, title FROM tasks WHERE ${guard}${clause} ORDER BY created_at DESC LIMIT 1`).get(...params)
  }

  const updateTask = tool(
    async ({ title, new_title, due_date, priority, status, notes, recurrence, project }) => {
      const task = await findTask(title, false)
      if (!task) return JSON.stringify({ ok: false, message: `No task matching "${title}".` })
      const sets = []
      const p = { id: task.id, ts: now() }
      if (new_title) { sets.push('title = @title'); p.title = new_title }
      if (due_date !== undefined) { sets.push('due_date = @due'); p.due = due_date || null }
      if (priority) { sets.push('priority = @priority'); p.priority = priority }
      if (status) { sets.push('status = @status'); p.status = status; if (status === 'done') sets.push('completed_at = @ts') }
      if (notes !== undefined) { sets.push('notes = @notes'); p.notes = notes }
      if (recurrence) { sets.push('recurrence = @recurrence'); p.recurrence = recurrence }
      if (project !== undefined) { sets.push('project_id = @pid'); p.pid = await resolveProjectId(project) }
      if (!sets.length) return JSON.stringify({ ok: false, message: 'Nothing to update.' })
      await db.prepare(`UPDATE tasks SET ${sets.join(', ')}, updated_at = @ts WHERE id = @id`).run(p)
      record(`✏️ Updated “${task.title}”`)
      return JSON.stringify({ ok: true, id: task.id })
    },
    {
      name: 'update_task',
      description: 'Edit an existing task (found by a title fragment): rename, change due date, priority, status, notes/description, recurrence, or project.',
      schema: z.object({
        title: z.string().describe('part of the task title to find it'),
        new_title: z.string().optional(),
        due_date: z.string().optional(),
        priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
        status: z.enum(['todo', 'doing', 'done']).optional(),
        notes: z.string().optional().describe('description / extra detail'),
        recurrence: z.enum(['single', 'daily', 'weekly', 'monthly', 'yearly']).optional(),
        project: z.string().optional().describe('project name/short_code to attach (empty string to clear)'),
      }),
    },
  )

  const completeTask = tool(
    async ({ title }) => {
      const task = await findTask(title, true)
      if (!task) return JSON.stringify({ ok: false, message: `No open task matching "${title}".` })
      await db.prepare("UPDATE tasks SET status = 'done', completed_at = @ts, updated_at = @ts WHERE id = @id").run({ id: task.id, ts: now() })
      record(`✅ Completed “${task.title}”`)
      return JSON.stringify({ ok: true, id: task.id })
    },
    { name: 'complete_task', description: 'Mark an open task done, found by a title fragment.', schema: z.object({ title: z.string() }) },
  )

  const deleteTask = tool(
    async ({ title }) => {
      const task = await findTask(title, false)
      if (!task) return JSON.stringify({ ok: false, message: `No task matching "${title}".` })
      await db.prepare('DELETE FROM tasks WHERE id = ?').run(task.id)
      record(`🗑️ Deleted task “${task.title}”`)
      return JSON.stringify({ ok: true, id: task.id })
    },
    { name: 'delete_task', description: 'Delete a task found by a title fragment.', schema: z.object({ title: z.string() }) },
  )

  const listTasks = tool(
    async ({ filter }) => {
      const where = filter === 'open' ? "WHERE status != 'done'" : filter === 'done' ? "WHERE status = 'done'" : ''
      const rows = await db.prepare(`SELECT id, title, status, due_date, priority FROM tasks ${where} ORDER BY (due_date IS NULL), due_date LIMIT 50`).all()
      return JSON.stringify({ tasks: rows })
    },
    { name: 'list_tasks', description: 'List tasks (filter: open | done | all) to see what exists.', schema: z.object({ filter: z.enum(['open', 'done', 'all']).optional() }) },
  )

  const findEventsTool = tool(
    async ({ query, from, to, flagship_only, limit }) => {
      const rows = await findEvents({ query, from, to, flagshipOnly: flagship_only, limit })
      return JSON.stringify({ count: rows.length, events: rows })
    },
    {
      name: 'find_events',
      description:
        'Search events across ALL days by title fragment (and optional date range). Returns id, title, start, flagship, source. ALWAYS call this before delete_event when the user names an event — get_schedule is only one day and is easy to misread.',
      schema: z.object({
        query: z.string().optional().describe('title contains this (e.g. "Arya", "[PRKB/England]")'),
        from: z.string().optional().describe('YYYY-MM-DD inclusive'),
        to: z.string().optional().describe('YYYY-MM-DD inclusive'),
        flagship_only: z.boolean().optional().describe('true = only month-calendar events'),
        limit: z.number().int().optional().describe('max rows (default 25)'),
      }),
    },
  )

  const listFlagshipEvents = tool(
    async ({ from, to }) => {
      const rows = await findEvents({ from, to, flagshipOnly: true, limit: 50 })
      return JSON.stringify({ count: rows.length, events: rows })
    },
    {
      name: 'list_flagship_events',
      description: 'List month-calendar (flagship) events in a date range. Use before creating/editing flagship events so you know what already exists.',
      schema: z.object({
        from: z.string().optional().describe('YYYY-MM-DD inclusive; omit for no lower bound'),
        to: z.string().optional().describe('YYYY-MM-DD inclusive; omit for no upper bound'),
      }),
    },
  )

  const deleteEvent = tool(
    async ({ event_id }) => {
      const result = await removeEventById(event_id)
      if (!result.ok) return JSON.stringify(result)
      record(`🗑️ Removed “${result.title}”`)
      return JSON.stringify({ ok: true, id: event_id, title: result.title })
    },
    {
      name: 'delete_event',
      description: 'Delete a single event by its id. ALWAYS find_events first when the user names an event — never guess ids from get_schedule. Do NOT re-create events to "clear" them.',
      schema: z.object({ event_id: z.string() }),
    },
  )

  const COLOR_ENUM = z.enum(['blue', 'violet', 'emerald', 'amber', 'rose', 'orange', 'teal', 'slate', 'red'])

  const scheduleRecurringEvent = tool(
    async ({ title, weekdays, frequency, start_time, end_time, duration_minutes, all_day, start_date, until_date, occurrences, location, notes, color, flagship, project, calendar }) => {
      const day = start_date || localDateStr()
      const startIso = all_day ? day : `${day}T${start_time || '09:00'}:00`
      const endIso = all_day ? day : (end_time ? `${day}T${end_time}:00` : addMinutes(startIso, duration_minutes || 60))

      if (flagship) calendar = 'local'

      if (!isLocalOnly(calendar)) {
        let target = null
        let provider = null
        try {
          target = await googleI.resolveCalendarTarget(calendar)
          if (target) provider = 'google'
        } catch { /* fall through */ }
        if (!target) {
          try {
            target = await microsoftI.resolveCalendarTarget(calendar)
            if (target) provider = 'microsoft'
          } catch { /* fall through */ }
        }
        if (target && provider === 'google') {
          const r = await googleI.createRecurringEvent({
            email: target.email, calendarId: target.calendarId, title,
            start: startIso, end: endIso, allDay: !!all_day, location, notes,
            frequency, weekdays, until: until_date, count: occurrences,
          })
          record(`📅 Scheduled recurring “${title}” on ${target.email}`)
          return JSON.stringify({ ok: true, recurring: true, calendar: target.email, recurringEventId: r.recurringEventId })
        }
        if (target && provider === 'microsoft') {
          const r = await microsoftI.createRecurringEvent({
            email: target.email, calendarId: target.calendarId, title,
            start: startIso, end: endIso, allDay: !!all_day, location, notes,
            frequency, weekdays, until: until_date, count: occurrences,
          })
          record(`📅 Scheduled recurring “${title}” on ${target.email}`)
          return JSON.stringify({ ok: true, recurring: true, calendar: target.email, recurringEventId: r.recurringEventId })
        }
        if (calendar) return JSON.stringify({ ok: false, message: `No connected calendar matching “${calendar}”. Try a Google/Outlook calendar name, or say "local".` })
      }

      const occ = expandRecurrence({
        frequency, weekdays, startDate: start_date, untilDate: until_date, occurrences,
        allDay: !!all_day, startTime: start_time, endTime: end_time, durationMinutes: duration_minutes,
      })
      if (!occ.length) return JSON.stringify({ ok: false, message: 'That recurrence matched no dates.' })
      const ts = now()
      const seriesId = newId()
      const projectId = await resolveProjectId(project)
      for (const o of occ) {
        await db
          .prepare(`INSERT INTO events (id,title,start,"end",all_day,location,notes,color,flagship,series_id,project_id,source,created_at,updated_at)
            VALUES (@id,@title,@start,@end,@all_day,@location,@notes,@color,@flagship,@series_id,@pid,'assistant',@ts,@ts)`)
          .run({
            id: newId(), title, start: o.start, end: o.end, all_day: all_day ? 1 : 0,
            location: location || '', notes: notes || '', color: color || 'blue',
            flagship: flagship ? 1 : 0, series_id: seriesId, pid: projectId, ts,
          })
      }
      record(`📅 Scheduled “${title}” — ${occ.length} occurrences`)
      return JSON.stringify({ ok: true, series_id: seriesId, count: occ.length, first: occ[0].start, last: occ[occ.length - 1].start })
    },
    {
      name: 'schedule_recurring_event',
      description:
        'Create a REPEATING event for "every weekday", "every Mon/Wed/Fri", "daily", "every Tuesday", etc. By DEFAULT it creates ONE native recurring event on the default Google calendar (Yahoo) — Google expands it, and it shows in the app. Pass calendar="yale"/"rotunda"/a name for another, or calendar="local" for app-only. Specify weekdays (0=Sun..6=Sat): Mon–Fri=[1,2,3,4,5], MWF=[1,3,5], weekends=[0,6]; omit for every day. Times in 24h HH:mm (4–5pm = "16:00"/"17:00").',
      schema: z.object({
        title: z.string(),
        calendar: z.string().optional().describe('omit for default (Yahoo); "yale"/"rotunda"/a calendar name; or "local" for app-only'),
        weekdays: z.array(z.number().int().min(0).max(6)).optional().describe('0=Sun..6=Sat; omit for every day'),
        frequency: z.enum(['daily', 'weekly']).optional(),
        start_time: z.string().optional().describe('24h HH:mm, e.g. 16:00'),
        end_time: z.string().optional().describe('24h HH:mm'),
        duration_minutes: z.number().int().optional(),
        all_day: z.boolean().optional(),
        start_date: z.string().optional().describe('YYYY-MM-DD; defaults today'),
        until_date: z.string().optional().describe('YYYY-MM-DD; last day, inclusive'),
        occurrences: z.number().int().optional().describe('cap on number of occurrences'),
        location: z.string().optional(),
        notes: z.string().optional(),
        color: COLOR_ENUM.optional(),
        flagship: z.boolean().optional(),
        project: z.string().optional(),
      }),
    },
  )

  const deleteEventSeries = tool(
    async ({ series_id }) => {
      const rows = await db.prepare('SELECT id FROM events WHERE series_id = ?').all(series_id)
      if (!rows.length) return JSON.stringify({ ok: false, message: 'No events found for that series.' })
      await db.prepare('DELETE FROM events WHERE series_id = ?').run(series_id)
      record(`🗑️ Removed recurring series (${rows.length} events)`)
      return JSON.stringify({ ok: true, deleted: rows.length })
    },
    {
      name: 'delete_event_series',
      description: 'Delete ALL occurrences of a recurring event by its series_id (get it from get_schedule). Use for "delete the recurring X / cancel the whole series".',
      schema: z.object({ series_id: z.string() }),
    },
  )

  // Bulk-delete events matching a title fragment and/or Google account and/or
  // date range — across ALL days unless from/to is given. One call instead of
  // looping day-by-day. Pushes deletions through to Google for synced events.
  const deleteEvents = tool(
    async ({ query, account, from, to }) => {
      const where = []
      const params = []
      if (query) { where.push('title ILIKE ?'); params.push(`%${query}%`) }
      if (account) { where.push('google_account ILIKE ?'); params.push(`%${account}%`) }
      if (from) { where.push('substr(start,1,10) >= ?'); params.push(from) }
      if (to) { where.push('substr(start,1,10) <= ?'); params.push(to) }
      if (!where.length) return JSON.stringify({ ok: false, message: 'Give a title query, a Google account, and/or a date range so I know what to delete.' })
      if (query && query.trim().length < 2) return JSON.stringify({ ok: false, message: 'Title query is too short — use at least 2 characters, or find_events first to confirm targets.' })
      const clause = where.join(' AND ')
      const rows = await db.prepare(`SELECT id, title FROM events WHERE ${clause}`).all(...params)
      if (!rows.length) return JSON.stringify({ ok: true, deleted: 0, message: 'No matching events found.' })
      for (const ev of rows) await removeEventById(ev.id)
      record(`🗑️ Deleted ${rows.length} event${rows.length === 1 ? '' : 's'}${query ? ` matching “${query}”` : ''}`)
      return JSON.stringify({ ok: true, deleted: rows.length })
    },
    {
      name: 'delete_events',
      description:
        'Delete MANY events at once by a title fragment and/or a Google account and/or a date range — across ALL days unless from/to is given. Use this for "clear all my X events", "remove every Skill event on yahoo", "delete all gym blocks this week", etc. ALWAYS prefer this over clearing day-by-day. Deletions sync through to Google.',
      schema: z.object({
        query: z.string().optional().describe('title contains this (e.g. "Skill", "[To Do]")'),
        account: z.string().optional().describe('limit to a Google account, fragment ok (e.g. "yahoo")'),
        from: z.string().optional().describe('YYYY-MM-DD inclusive; omit to span all days'),
        to: z.string().optional().describe('YYYY-MM-DD inclusive; omit to span all days'),
      }),
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
      const ev = await db.prepare('SELECT * FROM events WHERE id = ?').get(event_id)
      if (!ev) return JSON.stringify({ ok: false, message: 'No event with that id.' })
      const finish = end || start
      if (ev.source === 'google') {
        try { await googleI.pushUpdate(ev, { start, end: finish }) } catch (err) {
          return JSON.stringify({ ok: false, message: `Couldn't move on Google: ${err.message}` })
        }
      }
      if (ev.source === 'microsoft') {
        try { await microsoftI.pushUpdate(ev, { start, end: finish }) } catch (err) {
          return JSON.stringify({ ok: false, message: `Couldn't move on Outlook: ${err.message}` })
        }
      }
      await db.prepare('UPDATE events SET start = ?, "end" = ?, updated_at = ? WHERE id = ?').run(start, finish, now(), event_id)
      record(`🕑 Moved “${ev.title}”`)
      return JSON.stringify({ ok: true, id: event_id, start, end: finish })
    },
    {
      name: 'reschedule_event',
      description: 'Move an existing event to a new start/end (ids from find_events). Use this to move things — never delete + recreate.',
      schema: z.object({ event_id: z.string(), start: z.string(), end: z.string().optional() }),
    },
  )

  return [
    // Schedule / calendar
    getSchedule, findEventsTool, listFlagshipEvents, findFreeSlot, scheduleEvent, scheduleRecurringEvent, updateEvent, deleteEvent, deleteEvents, deleteEventSeries, clearDay, rescheduleEvent,
    // Tasks
    createTask, updateTask, completeTask, deleteTask, setTaskPriority, listTasks,
    // Everything else, by domain
    ...buildGymTools({ record }),
    ...buildNotesTools({ record }),
    ...buildRugbyTools({ record }),
    ...buildProjectTools({ record }),
    ...buildListTools({ record }),
    ...buildInboxTools({ record }),
    ...buildPinsTools({ record }),
  ]
}
