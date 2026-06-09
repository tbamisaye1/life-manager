import OpenAI from 'openai'
import { db } from '../db/index.js'
import { newId, now, localDateStr } from './helpers.js'

export const assistantConfigured = () => Boolean(process.env.OPENAI_API_KEY)
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini'

// ---- helpers ---------------------------------------------------------------
const pad = (n) => String(n).padStart(2, '0')
const minsToLocalIso = (date, mins) => `${date}T${pad(Math.floor(mins / 60))}:${pad(mins % 60)}:00`
const localMinsOf = (iso) => { const d = new Date(iso); return d.getHours() * 60 + d.getMinutes() }

/**
 * Find the first free gap of `duration` minutes on `date`, scanning the day's
 * timed events between earliest..latest (local wall-clock). Returns naive local
 * ISO strings, or null if the day is full.
 */
async function findFreeSlot(date, duration = 60, earliest = '08:00', latest = '22:00') {
  const [eh, em] = earliest.split(':').map(Number)
  const [lh, lm] = latest.split(':').map(Number)
  let cursor = eh * 60 + em
  const end = lh * 60 + lm
  const events = await db.prepare(
    "SELECT start, \"end\" FROM events WHERE all_day = 0 AND substr(start,1,10) = ? ORDER BY start",
  ).all(date)
  const busy = events
    .map((e) => ({ s: localMinsOf(e.start), e: e.end ? localMinsOf(e.end) : localMinsOf(e.start) + 60 }))
    .sort((a, b) => a.s - b.s)
  for (const b of busy) {
    if (b.s - cursor >= duration) break
    if (b.e > cursor) cursor = b.e
  }
  if (cursor + duration > end) return null
  return { start: minsToLocalIso(date, cursor), end: minsToLocalIso(date, cursor + duration) }
}

// ---- tool definitions (OpenAI function-calling) ----------------------------
const tools = [
  { type: 'function', function: { name: 'get_schedule', description: "Get the user's events/blocks for a date (default today). Use before scheduling.", parameters: { type: 'object', properties: { date: { type: 'string', description: 'YYYY-MM-DD; omit for today' } } } } },
  { type: 'function', function: { name: 'find_free_slot', description: 'Find the first free time block of a given duration on a date.', parameters: { type: 'object', properties: { date: { type: 'string' }, duration_minutes: { type: 'integer' }, earliest: { type: 'string', description: 'HH:mm' }, latest: { type: 'string', description: 'HH:mm' } }, required: ['duration_minutes'] } } },
  { type: 'function', function: { name: 'create_event', description: 'Create a timed block on the daily schedule / calendar.', parameters: { type: 'object', properties: { title: { type: 'string' }, start: { type: 'string', description: 'local ISO YYYY-MM-DDTHH:mm:00' }, end: { type: 'string' }, duration_minutes: { type: 'integer' }, all_day: { type: 'boolean' } }, required: ['title', 'start'] } } },
  { type: 'function', function: { name: 'create_task', description: 'Create a task or reminder.', parameters: { type: 'object', properties: { title: { type: 'string' }, due_date: { type: 'string', description: 'local ISO; optional' }, priority: { type: 'string', enum: ['low', 'normal', 'high', 'urgent'] }, project_name: { type: 'string' } }, required: ['title'] } } },
  { type: 'function', function: { name: 'set_task_priority', description: "Change the priority of an existing task found by a title fragment.", parameters: { type: 'object', properties: { title: { type: 'string' }, priority: { type: 'string', enum: ['low', 'normal', 'high', 'urgent'] } }, required: ['title', 'priority'] } } },
  { type: 'function', function: { name: 'create_bored_item', description: "Add something to the user's 'I'm Bored' list to come back to later.", parameters: { type: 'object', properties: { title: { type: 'string' }, category: { type: 'string', enum: ['learn', 'project', 'improve', 'fun', 'other'] } }, required: ['title'] } } },
]

// ---- tool executors --------------------------------------------------------
const executors = {
  async get_schedule({ date }) {
    const d = date || localDateStr()
    const events = await db.prepare(
      "SELECT title, start, \"end\", all_day FROM events WHERE substr(start,1,10) = ? ORDER BY all_day DESC, start",
    ).all(d)
    return { date: d, events }
  },
  async find_free_slot({ date, duration_minutes, earliest, latest }) {
    const d = date || localDateStr()
    const slot = await findFreeSlot(d, duration_minutes || 60, earliest || '08:00', latest || '22:00')
    return slot ? { date: d, ...slot } : { date: d, free: false, message: 'No free slot in range.' }
  },
  async create_event({ title, start, end, duration_minutes, all_day }) {
    const ts = now(); const id = newId()
    let finalEnd = end
    if (!finalEnd && !all_day) {
      const s = new Date(start)
      if (!isNaN(s.getTime())) {
        s.setMinutes(s.getMinutes() + (duration_minutes || 60))
        // Build from local components so a block crossing midnight gets the right date.
        finalEnd = `${s.getFullYear()}-${pad(s.getMonth() + 1)}-${pad(s.getDate())}T${pad(s.getHours())}:${pad(s.getMinutes())}:00`
      } else {
        finalEnd = start
      }
    }
    await db.prepare(`INSERT INTO events (id,title,start,"end",all_day,location,notes,color,source,created_at,updated_at)
      VALUES (@id,@title,@start,@end,@all_day,'','','blue','assistant',@ts,@ts)`).run({
      id, title, start, end: finalEnd || start, all_day: all_day ? 1 : 0, ts,
    })
    return { ok: true, event: { id, title, start, end: finalEnd || start } }
  },
  async create_task({ title, due_date, priority, project_name }) {
    const ts = now(); const id = newId()
    let project_id = null
    if (project_name) {
      const p = await db.prepare('SELECT id FROM projects WHERE name ILIKE ? OR short_code ILIKE ? LIMIT 1')
        .get(`%${project_name}%`, `%${project_name}%`)
      project_id = p?.id || null
    }
    await db.prepare(`INSERT INTO tasks (id,title,status,emoji,due_date,priority,recurrence,project_id,notes,source,created_at,updated_at)
      VALUES (@id,@title,'todo','📌',@due,@priority,'single',@pid,'','assistant',@ts,@ts)`).run({
      id, title, due: due_date || null, priority: priority || 'normal', pid: project_id, ts,
    })
    return { ok: true, task: { id, title, priority: priority || 'normal', due_date: due_date || null } }
  },
  async set_task_priority({ title, priority }) {
    // Match a task that contains ALL of the words in the fragment, any order,
    // so "Carys essay" finds "Draft Carys college essay feedback".
    const words = String(title).trim().split(/\s+/).filter(Boolean).slice(0, 6)
    const clause = words.length ? words.map(() => 'title ILIKE ?').join(' AND ') : 'title ILIKE ?'
    const params = words.length ? words.map((w) => `%${w}%`) : [`%${title}%`]
    const t = await db.prepare(`SELECT id, title FROM tasks WHERE status != 'done' AND ${clause} ORDER BY created_at DESC LIMIT 1`).get(...params)
    if (!t) return { ok: false, message: `No open task matching "${title}".` }
    await db.prepare('UPDATE tasks SET priority = ?, updated_at = ? WHERE id = ?').run(priority, now(), t.id)
    return { ok: true, task: { id: t.id, title: t.title, priority } }
  },
  async create_bored_item({ title, category }) {
    const ts = now(); const id = newId()
    const max = (await db.prepare('SELECT COALESCE(MAX(sort_order), -1) m FROM bored_items').get()).m
    await db.prepare(`INSERT INTO bored_items (id,title,emoji,category,body,done,sort_order,created_at,updated_at)
      VALUES (@id,@title,'💡',@category,'',0,@ord,@ts,@ts)`).run({ id, title, category: category || 'other', ord: Number(max) + 1, ts })
    return { ok: true, item: { id, title } }
  },
}

const ACTION_LABEL = {
  create_event: (r) => r.ok && `📅 Scheduled “${r.event.title}”`,
  create_task: (r) => r.ok && `✅ Added task “${r.task.title}”${r.task.priority !== 'normal' ? ` (${r.task.priority})` : ''}`,
  set_task_priority: (r) => r.ok && `⚡ Set “${r.task.title}” to ${r.task.priority}`,
  create_bored_item: (r) => r.ok && `💡 Added “${r.item.title}” to your Bored list`,
}

function systemPrompt() {
  const d = new Date()
  return `You are the in-app assistant for "Life Manager", a personal productivity app. You can READ the user's schedule and PERFORM actions by calling tools — actually call them, don't just describe.

Right now it is ${d.toString()} (local time). Today's date is ${localDateStr()}.

The app has: a Daily Schedule (timed event blocks) + a month Calendar (same events), Tasks (with priority low/normal/high/urgent; urgent/high are pinned in the header), an "I'm Bored" list of things to revisit, Notes, Projects, Gym, and Rugby.

Guidance:
- To "schedule time to do X": call get_schedule (or find_free_slot) to find a free gap today (or the given day), then create_event at that slot with a realistic duration. Default working hours 08:00–22:00.
- "Remind me / add a task to …" → create_task (set a due_date if a time is implied; set priority if they say urgent/important).
- "Make X urgent / high priority" → set_task_priority.
- "I want to look into X later" → create_bored_item.
- Use local naive ISO datetimes "YYYY-MM-DDTHH:mm:00" for start/end/due_date.
- Be concise and friendly. After acting, confirm what you did in one or two sentences. Ask a brief clarifying question only if the request is genuinely ambiguous.
- Reply in plain text — no markdown, asterisks, bullet characters, or headers.`
}

/** Run one assistant turn over the full message history. Returns { reply, actions }. */
export async function runAssistant(history) {
  if (!assistantConfigured()) {
    return { reply: 'The assistant needs an OpenAI API key. Add OPENAI_API_KEY to your .env and restart.', actions: [], configured: false }
  }
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const messages = [{ role: 'system', content: systemPrompt() }, ...history]
  const actions = []

  for (let step = 0; step < 6; step++) {
    const resp = await client.chat.completions.create({ model: MODEL, messages, tools, tool_choice: 'auto' })
    const msg = resp.choices[0].message
    messages.push(msg)
    if (!msg.tool_calls?.length) {
      return { reply: msg.content || 'Done.', actions, configured: true }
    }
    for (const tc of msg.tool_calls) {
      let result
      try {
        const args = JSON.parse(tc.function.arguments || '{}')
        const exec = executors[tc.function.name]
        result = exec ? await exec(args) : { ok: false, message: 'Unknown tool' }
        const label = ACTION_LABEL[tc.function.name]?.(result)
        if (label) actions.push(label)
      } catch (err) {
        result = { ok: false, error: err.message }
      }
      messages.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(result) })
    }
  }
  return { reply: "I've done what I could — check your schedule and tasks.", actions, configured: true }
}
