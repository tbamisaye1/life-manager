import { Router } from 'express'
import { db } from '../db/index.js'

const router = Router()

const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d }
const endOfToday = () => { const d = new Date(); d.setHours(23, 59, 59, 999); return d }

// GET /api/today — everything the user needs for "what do I do today?"
router.get('/today', (req, res) => {
  const todayStart = startOfToday().toISOString()
  const todayEnd = endOfToday().toISOString()
  const todayDate = startOfToday().toISOString().slice(0, 10)
  const nowIso = new Date().toISOString()

  const events = db.prepare(`SELECT e.*, p.short_code project_code FROM events e LEFT JOIN projects p ON p.id = e.project_id
    WHERE (e.all_day = 1 AND substr(e.start,1,10) = @date)
       OR (e.all_day = 0 AND e.start >= @start AND e.start <= @end)
    ORDER BY e.all_day DESC, e.start`).all({ date: todayDate, start: todayStart, end: todayEnd })

  const dueToday = db.prepare(`SELECT t.*, p.short_code project_code, p.color project_color FROM tasks t LEFT JOIN projects p ON p.id = t.project_id
    WHERE t.status != 'done' AND t.due_date IS NOT NULL AND substr(t.due_date,1,10) = @date ORDER BY t.due_date`).all({ date: todayDate })

  const overdue = db.prepare(`SELECT t.*, p.short_code project_code, p.color project_color FROM tasks t LEFT JOIN projects p ON p.id = t.project_id
    WHERE t.status != 'done' AND t.due_date IS NOT NULL AND t.due_date < @now AND substr(t.due_date,1,10) != @date ORDER BY t.due_date`).all({ now: nowIso, date: todayDate })

  const priorities = db.prepare('SELECT * FROM priorities WHERE active = 1 ORDER BY sort_order').all()
  const needsReply = db.prepare('SELECT COUNT(*) c FROM emails WHERE needs_reply = 1').get().c
  const replyQueue = db.prepare('SELECT COUNT(*) c FROM reply_queue WHERE done = 0').get().c

  res.json({
    date: todayDate,
    events,
    dueToday,
    overdue,
    priorities: priorities.map((p) => ({
      ...p,
      done_for_period: p.last_done_at
        ? (p.cadence === 'weekly'
          ? (Date.now() - new Date(p.last_done_at).getTime()) / 864e5 < 7
          : p.last_done_at.slice(0, 10) === todayDate)
        : false,
    })),
    counts: { needsReply, replyQueue, overdue: overdue.length, dueToday: dueToday.length },
  })
})

// GET /api/bored — suggest one useful, goal-related thing to do right now.
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

  // 2) A daily/weekly priority not done for its period.
  const priorities = db.prepare('SELECT * FROM priorities WHERE active = 1').all()
  const undone = priorities.find((p) => !p.last_done_at || (p.cadence === 'daily' && p.last_done_at.slice(0, 10) !== new Date().toISOString().slice(0, 10)))
  if (undone) suggestions.push({
    kind: 'priority', emoji: undone.emoji || '✅',
    title: undone.title, context: `A ${undone.cadence} priority you haven't ticked off`, link: '/priorities',
  })

  // 3) The project you've gone longest without touching.
  const staleProject = db.prepare("SELECT * FROM projects WHERE archived = 0 ORDER BY (last_worked_at IS NULL) DESC, last_worked_at ASC LIMIT 1").get()
  if (staleProject) {
    const days = staleProject.last_worked_at ? Math.floor((Date.now() - new Date(staleProject.last_worked_at).getTime()) / 864e5) : null
    suggestions.push({
      kind: 'project', emoji: staleProject.emoji || '📁',
      title: `Check in on ${staleProject.name}`,
      context: days != null ? `You last worked on it ${days} day${days === 1 ? '' : 's'} ago` : "You haven't logged work here yet",
      link: `/projects/${staleProject.id}`,
    })
  }

  // 4) A pinned/needs-reply email.
  const email = db.prepare('SELECT * FROM emails WHERE needs_reply = 1 ORDER BY received_at LIMIT 1').get()
  if (email) suggestions.push({
    kind: 'email', emoji: '✉️',
    title: `Reply to ${email.from_name}`, context: email.reply_note || email.subject, link: '/email',
  })

  res.json({ suggestions, count: suggestions.length })
})

export default router
