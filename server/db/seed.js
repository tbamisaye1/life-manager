// Seeds clearly-fake demo data so a fresh install looks populated.
// Persona: a student athlete juggling classes, a side project, and club sports.
// Run with `npm run seed`. Safe to re-run: pass --force to wipe and reseed.
import { db, initDb } from './index.js'
import { newId, now } from '../lib/helpers.js'

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
  'favorites', 'recents', 'projects', 'pages', 'bored_items',
]

export async function seed({ force = false } = {}) {
  if (force) {
    for (const t of tables) await db.prepare(`DELETE FROM ${t}`).run()
  }

  // ---------------- Projects / jobs ----------------
  const projects = [
    { code: 'Northstar', name: 'Northstar (side project)', emoji: '🚀', color: 'violet', last: -1, desc: 'Demo SaaS side project — product, design, and shipping.' },
    { code: 'Research', name: 'Campus Research Lab', emoji: '🏛️', color: 'blue', last: -4, desc: 'Undergraduate research assistant — data cleaning and scripts.' },
    { code: 'Stats', name: 'Stats Coursework', emoji: '📊', color: 'emerald', last: -2, desc: 'Problem sets, readings, and group project for stats class.' },
    { code: 'BioLab', name: 'Bio Lab', emoji: '🔬', color: 'amber', last: -9, desc: 'Wet-lab research assistant. Weekly write-ups for the PI.' },
    { code: 'Mentoring', name: 'Peer Mentoring', emoji: '🎓', color: 'rose', last: -3, desc: 'Helping underclassmen with applications and study plans.' },
    { code: 'Rugby', name: 'Rugby', emoji: '🏉', color: 'orange', last: -1, desc: 'Club rugby. Performance and skills tracking.' },
    { code: 'Career', name: 'Career & Internships', emoji: '💼', color: 'slate', last: -6, desc: 'Applications, networking, and portfolio projects.' },
    { code: 'Personal', name: 'Personal', emoji: '🌱', color: 'teal', last: -1, desc: 'Life admin, errands, and hobbies.' },
  ]
  const projId = {}
  const insProject = db.prepare(`INSERT INTO projects (id,name,short_code,color,emoji,description,last_worked_at,archived,created_at,updated_at)
  VALUES (@id,@name,@short_code,@color,@emoji,@description,@last_worked_at,0,@ts,@ts)`)
  for (const p of projects) {
    const id = newId()
    projId[p.code] = id
    await insProject.run({ id, name: p.name, short_code: p.code, color: p.color, emoji: p.emoji, description: p.desc, last_worked_at: D(p.last), ts })
  }

  // ---------------- Tasks ----------------
  const tasks = [
    { t: 'Finish data-cleaning script', emoji: '🏛️', due: D(-57), pr: 'Research', priority: 'high', rec: 'single' },
    { t: 'Language practice (20 min)', emoji: '🔁', due: D(-1, '18:00'), pr: 'Personal', priority: 'normal', rec: 'daily' },
    { t: 'Friday shipping checklist', emoji: '🔁', due: D(-3, '19:30'), pr: 'Northstar', priority: 'high', rec: 'weekly' },
    { t: 'Stats problem set due', emoji: '🔁', due: D(-2, '23:59'), pr: 'Stats', priority: 'high', rec: 'weekly' },
    { t: 'Cancel unused streaming trial', emoji: '📄', due: D(-28), pr: 'Personal', priority: 'low', rec: 'single' },
    { t: 'Update resume bullet for lab work', emoji: '📄', due: D(-1), pr: 'Career', priority: 'normal', rec: 'single' },
    { t: 'Renew API credits if still needed', emoji: '📄', due: D(6), pr: 'Research', priority: 'normal', rec: 'single' },
    { t: 'Cancel gym day-pass leftover', emoji: '📄', due: D(23), pr: 'Personal', priority: 'low', rec: 'single' },
    { t: 'Pick fall courses', emoji: '🔬', due: D(73), pr: 'Career', priority: 'normal', rec: 'single' },
    { t: 'Review mentee essay draft', emoji: '🎓', due: D(2, '20:00'), pr: 'Mentoring', priority: 'high', rec: 'single' },
    { t: 'Send weekly update to Bio Lab PI', emoji: '🔬', due: D(1, '09:00'), pr: 'BioLab', priority: 'urgent', rec: 'weekly' },
    { t: 'Northstar: polish landing page copy', emoji: '🚀', due: D(0, '17:00'), pr: 'Northstar', priority: 'urgent', rec: 'single' },
    { t: 'Book physio for hamstring', emoji: '🏉', due: D(3), pr: 'Rugby', priority: 'normal', rec: 'single' },
  ]
  const insTask = db.prepare(`INSERT INTO tasks (id,title,status,emoji,due_date,priority,recurrence,project_id,notes,source,created_at,updated_at)
  VALUES (@id,@title,'todo',@emoji,@due,@priority,@rec,@project_id,'','local',@ts,@ts)`)
  for (const t of tasks) {
    await insTask.run({ id: newId(), title: t.t, emoji: t.emoji, due: t.due, priority: t.priority, rec: t.rec, project_id: projId[t.pr] ?? null, ts })
  }

  // ---------------- Calendar events ----------------
  const events = [
    { t: 'City FC match', d: -9, color: 'red' },
    { t: "Alex's house", d: -9, color: 'slate' },
    { t: 'Dinner with friends', d: -7, color: 'amber' },
    { t: 'Haircut 3pm', d: -7, time: '15:00', color: 'slate' },
    { t: 'Study group', d: -4, color: 'blue' },
    { t: 'Interview — research role', d: -4, time: '11:00', color: 'violet' },
    { t: 'Sam — coffee', d: -1, time: '10:00', color: 'emerald' },
    { t: 'Mentoring check-in', d: 2, time: '16:00', color: 'rose' },
    { t: 'Campus volunteer shift', d: 2, color: 'slate' },
    { t: 'Rugby training', d: 1, time: '19:00', color: 'orange', pr: 'Rugby', flag: 0 },
    { t: 'Northstar standup', d: 0, time: '09:30', color: 'violet', pr: 'Northstar', flag: 0 },
    { t: 'Jordan — catch up', d: 9, color: 'teal' },
    { t: 'Mentor call', d: 17, time: '14:00', color: 'blue' },
    { t: 'Club match vs Riverside', d: 6, time: '14:00', color: 'orange', pr: 'Rugby' },
  ]
  const insEvent = db.prepare(`INSERT INTO events (id,title,start,"end",all_day,location,notes,color,flagship,project_id,source,created_at,updated_at)
  VALUES (@id,@title,@start,@end,@all_day,'','',@color,@flagship,@project_id,'local',@ts,@ts)`)
  for (const e of events) {
    const allDay = e.time ? 0 : 1
    const start = e.time ? D(e.d, e.time) : dateOnly(e.d)
    const end = e.time ? D(e.d, addHour(e.time)) : dateOnly(e.d)
    await insEvent.run({ id: newId(), title: e.t, start, end, all_day: allDay, color: e.color, flagship: e.flag === 0 ? 0 : 1, project_id: projId[e.pr] ?? null, ts })
  }

  // ---------------- Daily / recurring priorities ----------------
  const priorities = [
    { t: 'Did I move Northstar forward today?', e: '🚀', c: 'daily' },
    { t: 'Check lab Slack / email', e: '🏛️', c: 'daily' },
    { t: '20 min language practice', e: '🇮🇹', c: 'daily' },
    { t: 'Rugby skills / gym', e: '🏉', c: 'daily' },
    { t: 'Mentoring check-in', e: '🎓', c: 'weekly' },
    { t: 'Apply to / research 1 opportunity', e: '💼', c: 'weekly' },
    { t: 'Inbox to zero-ish', e: '📥', c: 'daily' },
  ]
  const insPriority = db.prepare(`INSERT INTO priorities (id,title,cadence,emoji,sort_order,last_done_at,active,created_at,updated_at)
  VALUES (@id,@title,@cadence,@emoji,@sort_order,@last,1,@ts,@ts)`)
  for (const [i, p] of priorities.entries()) {
    await insPriority.run({ id: newId(), title: p.t, cadence: p.c, emoji: p.e, sort_order: i, last: i % 3 === 0 ? D(0) : null, ts })
  }

  // ---------------- Improvement points (own pages) ----------------
  const improvements = [
    { t: 'Become a clearer product thinker', e: '🚀', cat: 'career', sum: 'Sharpen the pitch and roadmap for Northstar.', why: 'Side projects teach shipping; clarity compounds.', prog: 40,
      actions: ['Rewrite the one-pager', 'Talk to 3 users this week', 'Study 3 well-written launch posts'] },
    { t: 'Ship cleaner code faster', e: '⚡', cat: 'skill', sum: 'Level up engineering velocity + quality.', why: 'I build the product; faster shipping = faster learning.', prog: 55,
      actions: ['Learn testing patterns', 'Refactor the data pipeline', 'Read 1 system-design piece/wk'] },
    { t: 'Rugby: explosive first 10m', e: '🏉', cat: 'fitness', sum: 'Improve acceleration and contact.', why: 'Biggest gap vs next level of play.', prog: 30,
      actions: ['Sprint drills 2x/wk', 'Tackle technique session', 'Track game metrics every match'] },
    { t: 'Be a better peer mentor', e: '🎓', cat: 'personal', sum: 'Help mentees without micromanaging.', why: 'Teaching locks in what I know.', prog: 60,
      actions: ['Weekly 30-min check-in', 'Build a shared deadlines doc', 'Share 2 useful resources each'] },
    { t: 'Build an internship edge', e: '💼', cat: 'career', sum: 'Concrete projects + network for future roles.', why: 'Optionality after graduation.', prog: 25,
      actions: ['Ship 1 portfolio project', 'Reach out to 2 people/wk', 'Keep a brag doc'] },
  ]
  const insImp = db.prepare(`INSERT INTO improvements (id,title,emoji,category,summary,body,why,progress,created_at,updated_at)
  VALUES (@id,@title,@emoji,@category,@summary,'',@why,@progress,@ts,@ts)`)
  const insAction = db.prepare(`INSERT INTO improvement_actions (id,improvement_id,text,done,created_at) VALUES (@id,@iid,@text,@done,@ts)`)
  for (const im of improvements) {
    const id = newId()
    await insImp.run({ id, title: im.t, emoji: im.e, category: im.cat, summary: im.sum, why: im.why, progress: im.prog, ts })
    for (const [i, a] of im.actions.entries()) {
      await insAction.run({ id: newId(), iid: id, text: a, done: i === 0 ? 1 : 0, ts })
    }
  }

  // ---------------- Notes ----------------
  const notes = [
    { title: 'Idea: weekly "what did I ship" digest', body: 'Auto-summarize what I worked on per project each Sunday. Could pull from task completions + rugby + improvements.', pinned: 1 },
    { title: 'Northstar — questions to prep', body: '- Who is the user?\n- Why now?\n- What is the wedge?\n- What ships next month?', pinned: 0 },
    { title: 'Random', body: 'Try the new ramen place with Jordan. Book it for next week.', pinned: 0 },
  ]
  const insNote = db.prepare(`INSERT INTO notes (id,title,body,pinned,color,created_at,updated_at) VALUES (@id,@title,@body,@pinned,'default',@ts,@ts)`)
  for (const n of notes) await insNote.run({ id: newId(), title: n.title, body: n.body, pinned: n.pinned, ts })

  // ---------------- Emails ----------------
  const emails = [
    { fn: 'Prof. Rivera', fe: 'rivera@lab.edu', sub: 'Re: weekly update', snip: 'Thanks — can you also include the new numbers by Friday?', recv: D(-1, '08:14'), read: 0, pin: 1, needs: 1, note: 'Reply with updated figures + timeline', pr: 'BioLab' },
    { fn: 'Taylor (mentee)', fe: 'taylor@example.com', sub: 'Essay draft 2', snip: 'Does this opening sound too cliché? Be honest!', recv: D(0, '07:40'), read: 0, pin: 1, needs: 1, note: 'Give line edits tonight', pr: 'Mentoring' },
    { fn: 'CloudInvoice', fe: 'no-reply@cloudinvoice.example', sub: 'Your invoice is available', snip: 'Dev tools plan — $12.00', recv: D(0, '06:02'), read: 1, pin: 0, needs: 0, pr: 'Research' },
    { fn: 'Morgan (mentor)', fe: 'morgan@example.com', sub: 'intro to a product designer', snip: 'Happy to intro you — free Thursday?', recv: D(-2, '15:30'), read: 1, pin: 0, needs: 1, note: 'Say yes, propose 2 times', pr: 'Northstar' },
    { fn: 'Campus Rec', fe: 'memberships@campusrec.example', sub: 'Your membership renews soon', snip: 'Your plan will renew on the 2nd.', recv: D(-3, '11:00'), read: 1, pin: 0, needs: 0, pr: 'Personal' },
  ]
  const insEmail = db.prepare(`INSERT INTO emails (id,from_name,from_email,subject,snippet,body,received_at,is_read,pinned,reply_note,needs_reply,project_id,source,created_at,updated_at)
  VALUES (@id,@fn,@fe,@sub,@snip,@snip,@recv,@read,@pin,@note,@needs,@pid,'local',@ts,@ts)`)
  for (const e of emails) {
    await insEmail.run({ id: newId(), fn: e.fn, fe: e.fe, sub: e.sub, snip: e.snip, recv: e.recv, read: e.read, pin: e.pin, note: e.note ?? null, needs: e.needs, pid: projId[e.pr] ?? null, ts })
  }

  // ---------------- Reply queue ----------------
  const replies = [
    { person: 'Sam', platform: 'imessage', context: 'Owes a reply about weekend plans', due: D(0) },
    { person: 'Alex', platform: 'whatsapp', context: 'Sent a voice note — reply about dinner', due: D(1) },
    { person: 'Club group chat', platform: 'instagram', context: 'Match logistics', due: null },
    { person: 'Pat', platform: 'snapchat', context: 'Asked about training times', due: null },
  ]
  const insReply = db.prepare(`INSERT INTO reply_queue (id,person,platform,context,due_date,done,created_at,updated_at)
  VALUES (@id,@person,@platform,@context,@due,0,@ts,@ts)`)
  for (const r of replies) await insReply.run({ id: newId(), person: r.person, platform: r.platform, context: r.context, due: r.due, ts })

  // ---------------- Rugby ----------------
  const sessions = [
    { d: -1, type: 'training', notes: 'Lineout + breakdown work. Felt sharp.', rating: 7, metrics: JSON.stringify({ minutes: 90, sprints: 12 }) },
    { d: -8, type: 'game', opp: 'Riverside 2nd XV', pos: 'Openside flanker', rating: 8, notes: 'Big game. 14 tackles, 1 turnover.', metrics: JSON.stringify({ tackles: 14, turnovers: 1, meters: 45, tries: 0 }) },
    { d: -15, type: 'game', opp: 'Old Boys', pos: 'Openside flanker', rating: 6, notes: 'Slow start, faded 2nd half.', metrics: JSON.stringify({ tackles: 9, turnovers: 0, meters: 30, tries: 1 }) },
  ]
  const insSession = db.prepare(`INSERT INTO rugby_sessions (id,date,type,opponent,position,rating,metrics,notes,created_at,updated_at)
  VALUES (@id,@date,@type,@opp,@pos,@rating,@metrics,@notes,@ts,@ts)`)
  for (const s of sessions) {
    await insSession.run({ id: newId(), date: D(s.d), type: s.type, opp: s.opp ?? null, pos: s.pos ?? null, rating: s.rating, metrics: s.metrics, notes: s.notes, ts })
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
  for (const [i, s] of skills.entries()) {
    await insSkill.run({ id: newId(), name: s.name, cur: s.cur, tgt: s.tgt, ord: i, ts })
  }

  // ---------------- Favorites (sidebar) ----------------
  const favorites = [
    { label: 'Today', icon: 'Sun', path: '/today', ord: 0 },
    { label: 'Tasks', icon: 'CheckSquare', path: '/tasks', ord: 1 },
    { label: 'Calendar', icon: 'Calendar', path: '/calendar', ord: 2 },
    { label: 'Northstar', icon: 'Rocket', path: '/projects', ord: 3 },
    { label: 'Rugby', icon: 'Dumbbell', path: '/rugby', ord: 4 },
  ]
  const insFav = db.prepare(`INSERT INTO favorites (id,label,icon,path,sort_order,created_at) VALUES (@id,@label,@icon,@path,@ord,@ts)`)
  for (const f of favorites) await insFav.run({ id: newId(), label: f.label, icon: f.icon, path: f.path, ord: f.ord, ts })

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
    await insEx.run({ id, name: e.name, cat: e.cat, mg: e.mg, unit: e.unit, lo: e.lo, hi: e.hi, sets: e.sets, inc: e.inc, notes: e.notes || '', ts })
  }

  const insRoutine = db.prepare(`INSERT INTO gym_routines (id,name,emoji,color,weekday,notes,sort_order,created_at,updated_at)
  VALUES (@id,@name,@emoji,@color,@weekday,'',@ord,@ts,@ts)`)
  const insRex = db.prepare('INSERT INTO gym_routine_exercises (id,routine_id,exercise_id,target_sets,sort_order) VALUES (?,?,?,?,?)')
  const routines = [
    { name: 'Push', emoji: '💪', color: 'violet', weekday: 1, items: ['bench', 'pullup'] },
    { name: 'Rehab + Legs', emoji: '🦵', color: 'emerald', weekday: 3, items: ['banded', 'balance', 'squat'] },
    { name: 'Pull', emoji: '🏋️', color: 'blue', weekday: 5, items: ['pullup', 'rdl'] },
  ]
  for (const [ri, r] of routines.entries()) {
    const rid = newId()
    await insRoutine.run({ id: rid, name: r.name, emoji: r.emoji, color: r.color, weekday: r.weekday, ord: ri, ts })
    for (const [i, k] of r.items.entries()) {
      await insRex.run(newId(), rid, exId[k], 3, i)
    }
  }

  // A past workout (~1 week ago) so progression suggestions have history.
  const insWorkout = db.prepare(`INSERT INTO gym_workouts (id,date,routine_id,title,notes,completed,created_at,updated_at)
  VALUES (@id,@date,null,@title,'',1,@ts,@ts)`)
  const insSet = db.prepare(`INSERT INTO gym_sets (id,workout_id,exercise_id,set_number,weight,reps,rpe,done,created_at)
  VALUES (@id,@wid,@ex,@num,@weight,@reps,null,1,@ts)`)
  const pastWorkout = newId()
  await insWorkout.run({ id: pastWorkout, date: dateOnly(-7), title: 'Push', ts })
  const log = async (ex, weight, repsArr) => {
    for (const [i, reps] of repsArr.entries()) {
      await insSet.run({ id: newId(), wid: pastWorkout, ex: exId[ex], num: i + 1, weight, reps, ts })
    }
  }
  await log('bench', 60, [8, 8, 8])   // hit top of 5-8 range -> suggestion will say go up
  await log('pullup', null, [9, 8, 7])

  // ---------------- Pages (OneNote/Notion-style workspace) ----------------
  const para = (text) => ({ type: 'paragraph', content: text ? [{ type: 'text', text }] : [] })
  const heading = (text, level = 2) => ({ type: 'heading', attrs: { level }, content: [{ type: 'text', text }] })
  const bullets = (items) => ({ type: 'bulletList', content: items.map((t) => ({ type: 'listItem', content: [para(t)] })) })
  const checks = (items) => ({ type: 'taskList', content: items.map(([t, done]) => ({ type: 'taskItem', attrs: { checked: !!done }, content: [para(t)] })) })
  const docOf = (...nodes) => JSON.stringify({ type: 'doc', content: nodes })

  let pageOrder = 0
  const insPage = db.prepare(`INSERT INTO pages (id,parent_id,title,icon,color,body,is_focus,sort_order,archived,created_at,updated_at)
  VALUES (@id,@parent,@title,@icon,@color,@body,@focus,@ord,0,@ts,@ts)`)
  const addPage = async ({ parent = null, title, icon = '📄', color = null, body = '', focus = 0 }) => {
    const id = newId()
    await insPage.run({ id, parent, title, icon, color, body, focus, ord: pageOrder++, ts })
    return id
  }

  const degree = await addPage({ title: 'Degree Planning', icon: '🎓', color: 'blue', focus: 1,
    body: docOf(heading('Degree Planning'), para('Mapping out classes, requirements, and the long game.')) })
  await addPage({ parent: degree, title: 'Fall 2026 courses', icon: '📚',
    body: docOf(heading('Fall 2026 — shortlist'), bullets(['Stats 365 — Intermediate ML', 'Econ elective', 'Language: Italian II']), para('Decide by course-selection deadline (Aug 21).')) })
  await addPage({ parent: degree, title: 'Major requirements', icon: '✅',
    body: docOf(heading('Requirements tracker'), checks([['Intro sequence', true], ['Methods requirement', false], ['Senior project', false]])) })

  const northstar = await addPage({ title: 'Northstar', icon: '🚀', color: 'violet',
    body: docOf(heading('Northstar'), para('Side-project brain-dump: product, users, and shipping.')) })
  await addPage({ parent: northstar, title: 'Product Q&A prep', icon: '💬', focus: 1,
    body: docOf(heading('Questions to nail'), bullets(['Who is the user?', 'Why now?', 'What is the wedge?', 'What ships next month?'])) })

  const jobs = await addPage({ title: 'Job Applications', icon: '💼', color: 'emerald' })
  await addPage({ parent: jobs, title: 'ML research assistant — imaging', icon: '🧠', focus: 1,
    body: docOf(
      heading('ML research assistant — imaging'),
      para('Research-assistant role: literature review + ML on imaging data.'),
      bullets(['Build the lit-review pipeline', 'Data prep + model training', 'Document the workflow cleanly']),
    ) })

  const brainstorms = await addPage({ title: 'Brainstorms', icon: '🧩', color: 'amber' })
  await addPage({ parent: brainstorms, title: 'Weekly "what did I ship" digest', icon: '📈',
    body: docOf(heading('Idea'), para('Auto-summarize what I worked on per project each Sunday — pull from task completions, rugby, and improvements.')) })

  // ---------------- "I'm Bored" curated list ----------------
  const insBored = db.prepare(`INSERT INTO bored_items (id,title,emoji,category,body,done,sort_order,created_at,updated_at)
  VALUES (@id,@title,@emoji,@category,@body,0,@ord,@ts,@ts)`)
  const boredItems = [
    { title: 'Learn chess openings', emoji: '♟️', category: 'learn', body: docOf(para('Work through the London System + a Sicilian response. 20 min on Lichess studies.')) },
    { title: 'Read a paper on diffusion models', emoji: '🔬', category: 'learn' },
    { title: 'Sketch the weekly "what did I ship" tool', emoji: '🚀', category: 'project', body: docOf(para('Rough out the data model + a Sunday digest email.')) },
    { title: 'Watch a rugby breakdown video', emoji: '🏉', category: 'improve' },
  ]
  for (const [i, b] of boredItems.entries()) {
    await insBored.run({ id: newId(), title: b.title, emoji: b.emoji, category: b.category, body: b.body || '', ord: i, ts })
  }
}

export async function seedIfEmpty() {
  const { c } = await db.prepare('SELECT COUNT(*) c FROM projects').get()
  if (Number(c) > 0) return false
  await seed()
  return true
}

function addHour(time) {
  const [h, m] = time.split(':').map(Number)
  return `${String((h + 1) % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const force = process.argv.includes('--force')
  await initDb()
  if (!force && !(await seedIfEmpty())) console.log('DB already seeded. Use `npm run seed -- --force` to reset.')
  else { if (force) await seed({ force: true }); console.log('✅ Seeded Life Manager with demo data.') }
  process.exit(0)
}
