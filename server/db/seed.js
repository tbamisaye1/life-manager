// Seeds realistic data for the Life Manager persona: a 19-yo founder /
// research assistant / rugby player juggling many jobs. Run with `npm run seed`.
// Safe to re-run: pass --force to wipe and reseed.
import { db } from './index.js'
import { newId, now } from '../lib/helpers.js'

const force = process.argv.includes('--force')

// --- date helpers (relative to today so the app always looks current) ---
const D = (offsetDays, time) => {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  if (time) {
    const [h, m] = time.split(':').map(Number)
    d.setHours(h, m, 0, 0)
  }
  return d.toISOString()
}
const dateOnly = (offsetDays) => D(offsetDays).slice(0, 10)
const ts = now()

const tables = [
  'improvement_actions', 'improvements', 'tasks', 'events', 'priorities',
  'gym_sets', 'gym_routine_exercises', 'gym_workouts', 'gym_routines', 'gym_exercises',
  'notes', 'emails', 'reply_queue', 'rugby_sessions', 'rugby_skills',
  'favorites', 'recents', 'projects', 'pages',
]

const seeded = db.prepare('SELECT COUNT(*) c FROM projects').get().c > 0
if (seeded && !force) {
  console.log('DB already seeded. Use `npm run seed -- --force` to reset.')
  process.exit(0)
}
if (force) {
  for (const t of tables) db.prepare(`DELETE FROM ${t}`).run()
}

// ---------------- Projects / jobs ----------------
const projects = [
  { code: 'Rotunda', name: 'Rotunda (my company)', emoji: '🚀', color: 'violet', last: -1, desc: 'Fundraising OS for campaigns. Founder duties: product, hiring, fundraising.' },
  { code: 'ISPS', name: 'ISPS Research Job', emoji: '🏛️', color: 'blue', last: -4, desc: 'Institution for Social & Policy Studies — data + scraping work.' },
  { code: 'S&DS', name: 'S&DS Lab', emoji: '📊', color: 'emerald', last: -2, desc: 'Statistics & Data Science research assistant.' },
  { code: 'BioLab', name: 'Bio Lab', emoji: '🔬', color: 'amber', last: -9, desc: 'Wet-lab research assistant. Weekly deliverables to PI.' },
  { code: 'Sisters', name: "Sisters' Admissions", emoji: '🎓', color: 'rose', last: -3, desc: "Managing my younger sisters' lives + college applications." },
  { code: 'Rugby', name: 'Rugby', emoji: '🏉', color: 'orange', last: -1, desc: 'Club + uni rugby. Performance and skills tracking.' },
  { code: 'Career', name: 'Career & Employment', emoji: '💼', color: 'slate', last: -6, desc: 'Future plans, applications, networking, skills for employability.' },
  { code: 'Personal', name: 'Personal', emoji: '🌱', color: 'teal', last: -1, desc: 'Life admin, subscriptions, errands.' },
]
const projId = {}
const insProject = db.prepare(`INSERT INTO projects (id,name,short_code,color,emoji,description,last_worked_at,archived,created_at,updated_at)
  VALUES (@id,@name,@short_code,@color,@emoji,@description,@last_worked_at,0,@ts,@ts)`)
for (const p of projects) {
  const id = newId()
  projId[p.code] = id
  insProject.run({ id, name: p.name, short_code: p.code, color: p.color, emoji: p.emoji, description: p.desc, last_worked_at: D(p.last), ts })
}

// ---------------- Tasks ----------------
const tasks = [
  { t: 'Figure out scraping fully', emoji: '🏛️', due: D(-57), pr: 'ISPS', priority: 'high', rec: 'single' },
  { t: 'Italian homework', emoji: '🔁', due: D(-1, '18:00'), pr: 'Personal', priority: 'normal', rec: 'daily' },
  { t: 'Friday work tasks', emoji: '🔁', due: D(-3, '19:30'), pr: 'Rotunda', priority: 'high', rec: 'weekly' },
  { t: 'S&DS homework due', emoji: '🔁', due: D(-2, '23:59'), pr: 'S&DS', priority: 'high', rec: 'weekly' },
  { t: 'Cancel Paramount+ subscription', emoji: '📄', due: D(-28), pr: 'Personal', priority: 'low', rec: 'single' },
  { t: "Tell SEA I'm earning minimum wage after receiving money", emoji: '📄', due: D(-1), pr: 'Career', priority: 'normal', rec: 'single' },
  { t: 'Cancel monthly Apify plan', emoji: '📄', due: D(6), pr: 'ISPS', priority: 'normal', rec: 'single' },
  { t: 'Cancel Everyone Active membership', emoji: '📄', due: D(23), pr: 'Personal', priority: 'low', rec: 'single' },
  { t: 'Pick fall courses', emoji: '🔬', due: D(73), pr: 'Career', priority: 'normal', rec: 'single' },
  { t: 'Draft Carys college essay feedback', emoji: '🎓', due: D(2, '20:00'), pr: 'Sisters', priority: 'high', rec: 'single' },
  { t: 'Send weekly update to Bio Lab PI', emoji: '🔬', due: D(1, '09:00'), pr: 'BioLab', priority: 'urgent', rec: 'weekly' },
  { t: 'Rotunda: review investor deck v3', emoji: '🚀', due: D(0, '17:00'), pr: 'Rotunda', priority: 'urgent', rec: 'single' },
  { t: 'Book physio for hamstring', emoji: '🏉', due: D(3), pr: 'Rugby', priority: 'normal', rec: 'single' },
]
const insTask = db.prepare(`INSERT INTO tasks (id,title,status,emoji,due_date,priority,recurrence,project_id,notes,source,created_at,updated_at)
  VALUES (@id,@title,'todo',@emoji,@due,@priority,@rec,@project_id,'','local',@ts,@ts)`)
for (const t of tasks) {
  insTask.run({ id: newId(), title: t.t, emoji: t.emoji, due: t.due, priority: t.priority, rec: t.rec, project_id: projId[t.pr] ?? null, ts })
}

// ---------------- Calendar events ----------------
const events = [
  { t: 'Arsenal match', d: -9, color: 'red' },
  { t: "Jimmy's house", d: -9, color: 'slate' },
  { t: 'Zamzam dinner', d: -7, color: 'amber' },
  { t: 'Haircut 3pm', d: -7, time: '15:00', color: 'slate' },
  { t: 'PRKB boys', d: -4, color: 'blue' },
  { t: 'Interview — research role', d: -4, time: '11:00', color: 'violet' },
  { t: 'Henry — coffee', d: -1, time: '10:00', color: 'emerald' },
  { t: '[Carys] college call', d: 2, time: '16:00', color: 'rose' },
  { t: 'HMP Highdown visit', d: 2, color: 'slate' },
  { t: 'Rugby training', d: 1, time: '19:00', color: 'orange', pr: 'Rugby' },
  { t: 'Rotunda standup', d: 0, time: '09:30', color: 'violet', pr: 'Rotunda' },
  { t: '[Hermela] catch up', d: 9, color: 'teal' },
  { t: 'Yvonne — mentor call', d: 17, time: '14:00', color: 'blue' },
  { t: 'Club match vs Saints', d: 6, time: '14:00', color: 'orange', pr: 'Rugby' },
]
const insEvent = db.prepare(`INSERT INTO events (id,title,start,"end",all_day,location,notes,color,project_id,source,created_at,updated_at)
  VALUES (@id,@title,@start,@end,@all_day,'','',@color,@project_id,'local',@ts,@ts)`)
for (const e of events) {
  const allDay = e.time ? 0 : 1
  const start = e.time ? D(e.d, e.time) : dateOnly(e.d)
  const end = e.time ? D(e.d, addHour(e.time)) : dateOnly(e.d)
  insEvent.run({ id: newId(), title: e.t, start, end, all_day: allDay, color: e.color, project_id: projId[e.pr] ?? null, ts })
}
function addHour(time) {
  const [h, m] = time.split(':').map(Number)
  return `${String((h + 1) % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

// ---------------- Daily / recurring priorities ----------------
const priorities = [
  { t: 'Did I move Rotunda forward today?', e: '🚀', c: 'daily' },
  { t: 'Check ISPS + lab Slack/email', e: '🏛️', c: 'daily' },
  { t: '20 min Italian', e: '🇮🇹', c: 'daily' },
  { t: 'Rugby skills / gym', e: '🏉', c: 'daily' },
  { t: "Check in on sisters' apps", e: '🎓', c: 'weekly' },
  { t: 'Apply to / research 1 opportunity', e: '💼', c: 'weekly' },
  { t: 'Inbox to zero-ish', e: '📥', c: 'daily' },
]
const insPriority = db.prepare(`INSERT INTO priorities (id,title,cadence,emoji,sort_order,last_done_at,active,created_at,updated_at)
  VALUES (@id,@title,@cadence,@emoji,@sort_order,@last,1,@ts,@ts)`)
priorities.forEach((p, i) => {
  insPriority.run({ id: newId(), title: p.t, cadence: p.c, emoji: p.e, sort_order: i, last: i % 3 === 0 ? D(0) : null, ts })
})

// ---------------- Improvement points (own pages) ----------------
const improvements = [
  { t: 'Become a stronger fundraiser', e: '🚀', cat: 'career', sum: 'Sharpen the pitch + investor pipeline for Rotunda.', why: 'Runway depends on it; this is the highest-leverage skill for me right now.', prog: 40,
    actions: ['Rewrite the deck narrative', 'Practice cold outreach (5/wk)', 'Study 3 successful campaign-tech raises'] },
  { t: 'Ship cleaner code faster', e: '⚡', cat: 'skill', sum: 'Level up engineering velocity + quality.', why: 'I build the product; faster shipping = faster learning.', prog: 55,
    actions: ['Learn testing patterns', 'Refactor scraping pipeline', 'Read 1 system-design piece/wk'] },
  { t: 'Rugby: explosive first 10m', e: '🏉', cat: 'fitness', sum: 'Improve acceleration and contact.', why: 'Biggest gap vs next level of play.', prog: 30,
    actions: ['Sprint drills 2x/wk', 'Tackle technique session', 'Track game metrics every match'] },
  { t: 'Be a better mentor to my sisters', e: '🎓', cat: 'personal', sum: 'Help them through admissions without micromanaging.', why: 'It matters more than almost anything else I do.', prog: 60,
    actions: ['Weekly 30-min check-in', 'Build a shared deadlines doc', 'Find 2 scholarships each'] },
  { t: 'Build an employability edge', e: '💼', cat: 'career', sum: 'Concrete projects + network for future roles.', why: 'Optionality after uni.', prog: 25,
    actions: ['Ship 1 portfolio project', 'Reach out to 2 people/wk', 'Keep a brag doc'] },
]
const insImp = db.prepare(`INSERT INTO improvements (id,title,emoji,category,summary,body,why,progress,created_at,updated_at)
  VALUES (@id,@title,@emoji,@category,@summary,'',@why,@progress,@ts,@ts)`)
const insAction = db.prepare(`INSERT INTO improvement_actions (id,improvement_id,text,done,created_at) VALUES (@id,@iid,@text,@done,@ts)`)
for (const im of improvements) {
  const id = newId()
  insImp.run({ id, title: im.t, emoji: im.e, category: im.cat, summary: im.sum, why: im.why, progress: im.prog, ts })
  im.actions.forEach((a, i) => insAction.run({ id: newId(), iid: id, text: a, done: i === 0 ? 1 : 0, ts }))
}

// ---------------- Notes ----------------
const notes = [
  { title: 'Idea: weekly "what did I ship" digest', body: 'Auto-summarize what I worked on per project each Sunday. Could pull from task completions + rugby + improvements.', pinned: 1 },
  { title: 'Rotunda — investor questions to prep', body: '- CAC / payback\n- Why now\n- Moat vs incumbents\n- Team gaps', pinned: 0 },
  { title: 'Random', body: 'Try the new ramen place with Hermela. Book it for next week.', pinned: 0 },
]
const insNote = db.prepare(`INSERT INTO notes (id,title,body,pinned,color,created_at,updated_at) VALUES (@id,@title,@body,@pinned,'default',@ts,@ts)`)
for (const n of notes) insNote.run({ id: newId(), title: n.title, body: n.body, pinned: n.pinned, ts })

// ---------------- Emails ----------------
const emails = [
  { fn: 'Prof. Adesanya', fe: 'adesanya@lab.edu', sub: 'Re: weekly update', snip: 'Thanks — can you also include the new scrape numbers by Friday?', recv: D(-1, '08:14'), read: 0, pin: 1, needs: 1, note: 'Reply with updated figures + timeline', pr: 'BioLab' },
  { fn: 'Carys', fe: 'carys@example.com', sub: 'My essay draft 2', snip: 'Does this opening sound too cliché? Be honest!', recv: D(0, '07:40'), read: 0, pin: 1, needs: 1, note: 'Give line edits tonight', pr: 'Sisters' },
  { fn: 'Stripe', fe: 'no-reply@stripe.com', sub: 'Your invoice is available', snip: 'Apify monthly plan — $49.00', recv: D(0, '06:02'), read: 1, pin: 0, needs: 0, pr: 'ISPS' },
  { fn: 'Yvonne (mentor)', fe: 'yvonne@vc.com', sub: 'intro to a campaign-tech angel', snip: 'Happy to intro you — free Thursday?', recv: D(-2, '15:30'), read: 1, pin: 0, needs: 1, note: 'Say yes, propose 2 times', pr: 'Rotunda' },
  { fn: 'Everyone Active', fe: 'memberships@ea.com', sub: 'Your membership renews soon', snip: 'Your plan will renew on the 2nd.', recv: D(-3, '11:00'), read: 1, pin: 0, needs: 0, pr: 'Personal' },
]
const insEmail = db.prepare(`INSERT INTO emails (id,from_name,from_email,subject,snippet,body,received_at,is_read,pinned,reply_note,needs_reply,project_id,source,created_at,updated_at)
  VALUES (@id,@fn,@fe,@sub,@snip,@snip,@recv,@read,@pin,@note,@needs,@pid,'local',@ts,@ts)`)
for (const e of emails) {
  insEmail.run({ id: newId(), fn: e.fn, fe: e.fe, sub: e.sub, snip: e.snip, recv: e.recv, read: e.read, pin: e.pin, note: e.note ?? null, needs: e.needs, pid: projId[e.pr] ?? null, ts })
}

// ---------------- Reply queue ----------------
const replies = [
  { person: 'Henry', platform: 'imessage', context: 'Owes him a reply about weekend plans', due: D(0) },
  { person: 'Zamzam', platform: 'whatsapp', context: 'Sent voice note — reply about dinner', due: D(1) },
  { person: 'PRKB group', platform: 'instagram', context: 'Match logistics', due: null },
  { person: 'Patrick', platform: 'snapchat', context: 'Streak + asked about training', due: null },
]
const insReply = db.prepare(`INSERT INTO reply_queue (id,person,platform,context,due_date,done,created_at,updated_at)
  VALUES (@id,@person,@platform,@context,@due,0,@ts,@ts)`)
for (const r of replies) insReply.run({ id: newId(), person: r.person, platform: r.platform, context: r.context, due: r.due, ts })

// ---------------- Rugby ----------------
const sessions = [
  { d: -1, type: 'training', notes: 'Lineout + breakdown work. Felt sharp.', rating: 7, metrics: JSON.stringify({ minutes: 90, sprints: 12 }) },
  { d: -8, type: 'game', opp: 'Saints 2nd XV', pos: 'Openside flanker', rating: 8, notes: 'Big game. 14 tackles, 1 turnover.', metrics: JSON.stringify({ tackles: 14, turnovers: 1, meters: 45, tries: 0 }) },
  { d: -15, type: 'game', opp: 'Old Boys', pos: 'Openside flanker', rating: 6, notes: 'Slow start, faded 2nd half.', metrics: JSON.stringify({ tackles: 9, turnovers: 0, meters: 30, tries: 1 }) },
]
const insSession = db.prepare(`INSERT INTO rugby_sessions (id,date,type,opponent,position,rating,metrics,notes,created_at,updated_at)
  VALUES (@id,@date,@type,@opp,@pos,@rating,@metrics,@notes,@ts,@ts)`)
for (const s of sessions) {
  insSession.run({ id: newId(), date: D(s.d), type: s.type, opp: s.opp ?? null, pos: s.pos ?? null, rating: s.rating, metrics: s.metrics, notes: s.notes, ts })
}
const skills = [
  { name: 'Explosive acceleration', cur: 5, tgt: 8 },
  { name: 'Tackle technique', cur: 7, tgt: 9 },
  { name: 'Breakdown / jackal', cur: 6, tgt: 9 },
  { name: 'Game awareness', cur: 6, tgt: 8 },
  { name: 'Kicking', cur: 4, tgt: 7 },
]
const insSkill = db.prepare(`INSERT INTO rugby_skills (id,name,current_level,target_level,notes,sort_order,created_at,updated_at)
  VALUES (@id,@name,@cur,@tgt,'',@ord,@ts,@ts)`)
skills.forEach((s, i) => insSkill.run({ id: newId(), name: s.name, cur: s.cur, tgt: s.tgt, ord: i, ts }))

// ---------------- Favorites (sidebar) ----------------
const favorites = [
  { label: 'Today', icon: 'Sun', path: '/today', ord: 0 },
  { label: 'Tasks', icon: 'CheckSquare', path: '/tasks', ord: 1 },
  { label: 'Calendar', icon: 'Calendar', path: '/calendar', ord: 2 },
  { label: 'Rotunda', icon: 'Rocket', path: '/projects', ord: 3 },
  { label: 'Rugby', icon: 'Dumbbell', path: '/rugby', ord: 4 },
]
const insFav = db.prepare(`INSERT INTO favorites (id,label,icon,path,sort_order,created_at) VALUES (@id,@label,@icon,@path,@ord,@ts)`)
for (const f of favorites) insFav.run({ id: newId(), label: f.label, icon: f.icon, path: f.path, ord: f.ord, ts })

// ---------------- Gym / Rehab ----------------
const insEx = db.prepare(`INSERT INTO gym_exercises (id,name,category,muscle_group,unit,rep_low,rep_high,default_sets,increment,notes,archived,created_at,updated_at)
  VALUES (@id,@name,@cat,@mg,@unit,@lo,@hi,@sets,@inc,@notes,0,@ts,@ts)`)
const exId = {}
const gymExercises = [
  { key: 'bench', name: 'Bench Press', cat: 'strength', mg: 'Chest', unit: 'kg', lo: 5, hi: 8, sets: 3, inc: 2.5 },
  { key: 'squat', name: 'Goblet Squat', cat: 'strength', mg: 'Legs', unit: 'kg', lo: 8, hi: 12, sets: 3, inc: 2.5 },
  { key: 'rdl', name: 'Romanian Deadlift', cat: 'strength', mg: 'Hamstrings', unit: 'kg', lo: 6, hi: 10, sets: 3, inc: 5 },
  { key: 'pullup', name: 'Pull-up', cat: 'strength', mg: 'Back', unit: 'bodyweight', lo: 5, hi: 10, sets: 3, inc: 0 },
  { key: 'banded', name: 'Banded Shoulder ER', cat: 'rehab', mg: 'Shoulder', unit: 'band', lo: 12, hi: 15, sets: 3, inc: 0, notes: 'Slow tempo, no pain. Rehab for the AC joint.' },
  { key: 'balance', name: 'Single-leg Balance', cat: 'rehab', mg: 'Ankle', unit: 'time', lo: 30, hi: 45, sets: 3, inc: 0, notes: 'Seconds per leg. Hamstring/ankle rehab.' },
]
for (const e of gymExercises) {
  const id = newId(); exId[e.key] = id
  insEx.run({ id, name: e.name, cat: e.cat, mg: e.mg, unit: e.unit, lo: e.lo, hi: e.hi, sets: e.sets, inc: e.inc, notes: e.notes || '', ts })
}

const insRoutine = db.prepare(`INSERT INTO gym_routines (id,name,emoji,color,weekday,notes,sort_order,created_at,updated_at)
  VALUES (@id,@name,@emoji,@color,@weekday,'',@ord,@ts,@ts)`)
const insRex = db.prepare('INSERT INTO gym_routine_exercises (id,routine_id,exercise_id,target_sets,sort_order) VALUES (?,?,?,?,?)')
const routines = [
  { name: 'Push', emoji: '💪', color: 'violet', weekday: 1, items: ['bench', 'pullup'] },
  { name: 'Rehab + Legs', emoji: '🦵', color: 'emerald', weekday: 3, items: ['banded', 'balance', 'squat'] },
  { name: 'Pull', emoji: '🏋️', color: 'blue', weekday: 5, items: ['pullup', 'rdl'] },
]
routines.forEach((r, ri) => {
  const rid = newId()
  insRoutine.run({ id: rid, name: r.name, emoji: r.emoji, color: r.color, weekday: r.weekday, ord: ri, ts })
  r.items.forEach((k, i) => insRex.run(newId(), rid, exId[k], 3, i))
})

// A past workout (~1 week ago) so progression suggestions have history.
const insWorkout = db.prepare(`INSERT INTO gym_workouts (id,date,routine_id,title,notes,completed,created_at,updated_at)
  VALUES (@id,@date,null,@title,'',1,@ts,@ts)`)
const insSet = db.prepare(`INSERT INTO gym_sets (id,workout_id,exercise_id,set_number,weight,reps,rpe,done,created_at)
  VALUES (@id,@wid,@ex,@num,@weight,@reps,null,1,@ts)`)
const pastWorkout = newId()
insWorkout.run({ id: pastWorkout, date: dateOnly(-7), title: 'Push', ts })
const log = (ex, weight, repsArr) => repsArr.forEach((reps, i) => insSet.run({ id: newId(), wid: pastWorkout, ex: exId[ex], num: i + 1, weight, reps, ts }))
log('bench', 60, [8, 8, 8])   // hit top of 5-8 range -> suggestion will say go up
log('pullup', null, [9, 8, 7])

// ---------------- Pages (OneNote/Notion-style workspace) ----------------
const para = (text) => ({ type: 'paragraph', content: text ? [{ type: 'text', text }] : [] })
const heading = (text, level = 2) => ({ type: 'heading', attrs: { level }, content: [{ type: 'text', text }] })
const bullets = (items) => ({ type: 'bulletList', content: items.map((t) => ({ type: 'listItem', content: [para(t)] })) })
const checks = (items) => ({ type: 'taskList', content: items.map(([t, done]) => ({ type: 'taskItem', attrs: { checked: !!done }, content: [para(t)] })) })
const docOf = (...nodes) => JSON.stringify({ type: 'doc', content: nodes })

let pageOrder = 0
const insPage = db.prepare(`INSERT INTO pages (id,parent_id,title,icon,color,body,is_focus,sort_order,archived,created_at,updated_at)
  VALUES (@id,@parent,@title,@icon,@color,@body,@focus,@ord,0,@ts,@ts)`)
const addPage = ({ parent = null, title, icon = '📄', color = null, body = '', focus = 0 }) => {
  const id = newId()
  insPage.run({ id, parent, title, icon, color, body, focus, ord: pageOrder++, ts })
  return id
}

const degree = addPage({ title: 'Degree Planning', icon: '🎓', color: 'blue', focus: 1,
  body: docOf(heading('Degree Planning'), para('Mapping out classes, requirements, and the long game.')) })
addPage({ parent: degree, title: 'Fall 2026 courses', icon: '📚',
  body: docOf(heading('Fall 2026 — shortlist'), bullets(['S&DS 365 — Intermediate ML', 'Econ elective', 'Language: Italian II']), para('Decide by course-selection deadline (Aug 21).')) })
addPage({ parent: degree, title: 'Major requirements', icon: '✅',
  body: docOf(heading('Requirements tracker'), checks([['Intro sequence', true], ['Methods requirement', false], ['Senior project', false]])) })

const rotunda = addPage({ title: 'Rotunda', icon: '🚀', color: 'violet',
  body: docOf(heading('Rotunda'), para('Founder brain-dump: product, fundraising, hiring.')) })
addPage({ parent: rotunda, title: 'Investor Q&A prep', icon: '💬', focus: 1,
  body: docOf(heading('Questions to nail'), bullets(['CAC / payback period', 'Why now', 'Moat vs incumbents', 'Team gaps and the hiring plan'])) })

const jobs = addPage({ title: 'Job Applications', icon: '💼', color: 'emerald' })
addPage({ parent: jobs, title: 'AI Training job — Radiology', icon: '🧠', focus: 1,
  body: docOf(
    heading('AI Training job — Radiology'),
    para('Research-assistant role: literature review + ML on imaging data.'),
    bullets(['Build the lit-review pipeline', 'Mass data + model training', 'Connect agent teams / MCP for the workflow']),
  ) })

const brainstorms = addPage({ title: 'Brainstorms', icon: '🧩', color: 'amber' })
addPage({ parent: brainstorms, title: 'Weekly "what did I ship" digest', icon: '📈',
  body: docOf(heading('Idea'), para('Auto-summarize what I worked on per project each Sunday — pull from task completions, rugby, and improvements.')) })

console.log('✅ Seeded Life Manager with persona data.')
process.exit(0)
