import { Router } from 'express'
import { db } from '../db/index.js'
import { localDateStr } from '../lib/helpers.js'
import { isDoneForPeriod } from '../lib/period.js'

const router = Router()

const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d }
const endOfToday = () => { const d = new Date(); d.setHours(23, 59, 59, 999); return d }
const inDays = (n) => { const d = new Date(); d.setHours(23, 59, 59, 999); d.setDate(d.getDate() + n); return d }

// GET /api/today — everything the user needs for "what do I do today?"
router.get('/today', async (req, res) => {
  const todayStart = startOfToday().toISOString()
  const todayEnd = endOfToday().toISOString()
  const todayDate = localDateStr() // local calendar day, not UTC
  const nowIso = new Date().toISOString()
  const weekEnd = inDays(7).toISOString()

  const events = await db.prepare(`SELECT e.*, p.short_code project_code FROM events e LEFT JOIN projects p ON p.id = e.project_id
    WHERE (e.all_day = 1 AND substr(e.start,1,10) = @date)
       OR (e.all_day = 0 AND e.start >= @start AND e.start <= @end)
    ORDER BY e.all_day DESC, e.start`).all({ date: todayDate, start: todayStart, end: todayEnd })

  const dueToday = await db.prepare(`SELECT t.*, p.short_code project_code, p.color project_color FROM tasks t LEFT JOIN projects p ON p.id = t.project_id
    WHERE t.status != 'done' AND t.due_date IS NOT NULL AND substr(t.due_date,1,10) = @date ORDER BY t.due_date`).all({ date: todayDate })

  const overdue = await db.prepare(`SELECT t.*, p.short_code project_code, p.color project_color FROM tasks t LEFT JOIN projects p ON p.id = t.project_id
    WHERE t.status != 'done' AND t.due_date IS NOT NULL AND t.due_date < @now AND substr(t.due_date,1,10) != @date ORDER BY t.due_date`).all({ now: nowIso, date: todayDate })

  // Due in the next 7 days, excluding today + overdue — so near deadlines are visible.
  const dueThisWeek = await db.prepare(`SELECT t.*, p.short_code project_code, p.color project_color FROM tasks t LEFT JOIN projects p ON p.id = t.project_id
    WHERE t.status != 'done' AND t.due_date IS NOT NULL AND t.due_date > @end AND t.due_date <= @weekEnd
    ORDER BY t.due_date`).all({ end: todayEnd, weekEnd })

  const priorities = await db.prepare('SELECT * FROM priorities WHERE active = 1 ORDER BY sort_order').all()
  const needsReply = (await db.prepare('SELECT COUNT(*) c FROM emails WHERE needs_reply = 1').get()).c
  const replyQueue = (await db.prepare('SELECT COUNT(*) c FROM reply_queue WHERE done = 0').get()).c

  // Pinned: open high/urgent tasks — surfaced in the header so they can't be missed.
  const pinned = await db.prepare(`SELECT t.*, p.short_code project_code, p.color project_color FROM tasks t LEFT JOIN projects p ON p.id = t.project_id
    WHERE t.status != 'done' AND t.priority IN ('high','urgent')
    ORDER BY CASE t.priority WHEN 'urgent' THEN 0 ELSE 1 END, (t.due_date IS NULL), t.due_date`).all()

  res.json({
    date: todayDate,
    events,
    dueToday,
    overdue,
    dueThisWeek,
    pinned,
    priorities: priorities.map((p) => ({ ...p, done_for_period: isDoneForPeriod(p) })),
    counts: { needsReply, replyQueue, overdue: overdue.length, dueToday: dueToday.length, dueThisWeek: dueThisWeek.length, pinned: pinned.length },
  })
})

// GET /api/bored — pages you flagged as "focus" to revisit. The curated list
// itself lives in /api/bored-items; this just surfaces flagged notes pages.
router.get('/bored', async (req, res) => {
  const focusPages = await db.prepare('SELECT id, title, icon FROM pages WHERE is_focus = 1 AND archived = 0 ORDER BY updated_at DESC').all()
  res.json({ focusPages })
})

export default router
