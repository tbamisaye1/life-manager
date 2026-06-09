import { Router } from 'express'
import { db } from '../db/index.js'
import { localDateStr } from '../lib/helpers.js'
import { isDoneForPeriod } from '../lib/period.js'

const router = Router()

const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d }
const endOfToday = () => { const d = new Date(); d.setHours(23, 59, 59, 999); return d }
const inDays = (n) => { const d = new Date(); d.setHours(23, 59, 59, 999); d.setDate(d.getDate() + n); return d }

// GET /api/today — everything the user needs for "what do I do today?"
router.get('/today', (req, res) => {
  const todayStart = startOfToday().toISOString()
  const todayEnd = endOfToday().toISOString()
  const todayDate = localDateStr() // local calendar day, not UTC
  const nowIso = new Date().toISOString()
  const weekEnd = inDays(7).toISOString()

  const events = db.prepare(`SELECT e.*, p.short_code project_code FROM events e LEFT JOIN projects p ON p.id = e.project_id
    WHERE (e.all_day = 1 AND substr(e.start,1,10) = @date)
       OR (e.all_day = 0 AND e.start >= @start AND e.start <= @end)
    ORDER BY e.all_day DESC, e.start`).all({ date: todayDate, start: todayStart, end: todayEnd })

  const dueToday = db.prepare(`SELECT t.*, p.short_code project_code, p.color project_color FROM tasks t LEFT JOIN projects p ON p.id = t.project_id
    WHERE t.status != 'done' AND t.due_date IS NOT NULL AND substr(t.due_date,1,10) = @date ORDER BY t.due_date`).all({ date: todayDate })

  const overdue = db.prepare(`SELECT t.*, p.short_code project_code, p.color project_color FROM tasks t LEFT JOIN projects p ON p.id = t.project_id
    WHERE t.status != 'done' AND t.due_date IS NOT NULL AND t.due_date < @now AND substr(t.due_date,1,10) != @date ORDER BY t.due_date`).all({ now: nowIso, date: todayDate })

  // Due in the next 7 days, excluding today + overdue — so near deadlines are visible.
  const dueThisWeek = db.prepare(`SELECT t.*, p.short_code project_code, p.color project_color FROM tasks t LEFT JOIN projects p ON p.id = t.project_id
    WHERE t.status != 'done' AND t.due_date IS NOT NULL AND t.due_date > @end AND t.due_date <= @weekEnd
    ORDER BY t.due_date`).all({ end: todayEnd, weekEnd })

  const priorities = db.prepare('SELECT * FROM priorities WHERE active = 1 ORDER BY sort_order').all()
  const needsReply = db.prepare('SELECT COUNT(*) c FROM emails WHERE needs_reply = 1').get().c
  const replyQueue = db.prepare('SELECT COUNT(*) c FROM reply_queue WHERE done = 0').get().c

  res.json({
    date: todayDate,
    events,
    dueToday,
    overdue,
    dueThisWeek,
    priorities: priorities.map((p) => ({ ...p, done_for_period: isDoneForPeriod(p) })),
    counts: { needsReply, replyQueue, overdue: overdue.length, dueToday: dueToday.length, dueThisWeek: dueThisWeek.length },
  })
})

// GET /api/bored — suggest one useful, goal-related thing to do right now.
// Each source is randomized so refreshing ("Something else") gives real variety.
router.get('/bored', (req, res) => {
  const suggestions = []

  // 1) An unfinished action from an improvement goal.
  const action = db.prepare(`SELECT a.text, a.id action_id, i.title goal, i.emoji, i.id improvement_id
    FROM improvement_actions a JOIN improvements i ON i.id = a.improvement_id
    WHERE a.done = 0 ORDER BY RANDOM() LIMIT 1`).get()
  if (action) suggestions.push({
    kind: 'improvement', emoji: action.emoji || '🎯',
    title: action.text, context: `Toward your goal: ${action.goal}`,
    link: `/improvements/${action.improvement_id}`,
  })

  // 2) A daily/weekly priority not done for its period (random among the undone).
  const priorities = db.prepare('SELECT * FROM priorities WHERE active = 1').all().filter((p) => !isDoneForPeriod(p))
  const priority = priorities[Math.floor(seededFraction() * priorities.length)]
  if (priority) suggestions.push({
    kind: 'priority', emoji: priority.emoji || '✅',
    title: priority.title, context: `A ${priority.cadence} priority you haven't ticked off`, link: '/priorities',
  })

  // 3) A project not touched in 3+ days (random among the stale ones).
  const stale = db.prepare(`SELECT * FROM projects WHERE archived = 0
    AND (last_worked_at IS NULL OR last_worked_at < @cutoff) ORDER BY RANDOM() LIMIT 1`)
    .get({ cutoff: new Date(Date.now() - 3 * 864e5).toISOString() })
  if (stale) {
    const days = stale.last_worked_at ? Math.floor((Date.now() - new Date(stale.last_worked_at).getTime()) / 864e5) : null
    suggestions.push({
      kind: 'project', emoji: stale.emoji || '📁',
      title: `Check in on ${stale.name}`,
      context: days != null ? `You last worked on it ${days} day${days === 1 ? '' : 's'} ago` : "You haven't logged work here yet",
      link: `/projects/${stale.id}`,
    })
  }

  // 4) A random email still needing a reply.
  const email = db.prepare('SELECT * FROM emails WHERE needs_reply = 1 ORDER BY RANDOM() LIMIT 1').get()
  if (email) suggestions.push({
    kind: 'email', emoji: '✉️',
    title: `Reply to ${email.from_name}`, context: email.reply_note || email.subject, link: '/email',
  })

  res.json({ suggestions, count: suggestions.length })
})

// Cheap per-request randomness without Math.random (kept deterministic-friendly).
function seededFraction() {
  return (Date.now() % 1000) / 1000
}

export default router
