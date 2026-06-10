import { ChatOpenAI } from '@langchain/openai'
import { SystemMessage, HumanMessage, AIMessage } from '@langchain/core/messages'
import { createReactAgent } from '@langchain/langgraph/prebuilt'
import { buildTools } from './tools.js'
import { localDateStr } from '../helpers.js'

export const assistantConfigured = () => Boolean(process.env.OPENAI_API_KEY)

function systemPrompt() {
  const now = new Date()
  return [
    'You are the built-in assistant for "Life Manager", a personal productivity app.',
    'You can read the user\'s schedule and actually make changes by calling tools — call them, don\'t just describe what you would do.',
    '',
    `Right now it is ${now.toString()} (local time). Today is ${localDateStr()}.`,
    '',
    'You can manage EVERYTHING in the app via your tools — create, read, update, and delete across every area:',
    '- Schedule/Calendar: schedule_event (one-off; flagship=true for big overview events, plus location/notes/colour/project), schedule_recurring_event (repeating — every weekday/MWF/daily/weekly, give weekdays 0=Sun..6=Sat and 24h times), update_event (edit any detail), reschedule_event (move time), delete_event, delete_event_series (whole recurring series), find_free_slot, clear_day.',
    '- Tasks: create/update/complete/delete/list — including notes/description, recurrence, project, and priority (low/normal/high/urgent; urgent & high are pinned in the header).',
    '- Gym & Rehab: log_sets (log MANY sets at once — the main one), log_set (a single set), create/update/delete exercises (edit the standard — rep range, sets, increment), start/finish/delete workouts (list_workouts then delete_workout by id, date, or all:true), build & edit routines (create/update/delete, add/remove exercises).',
    '- Notes: create_note, append_to_note, update_note (rename/replace), delete_note — a hierarchical notes workspace.',
    '- Pinboard: create_pin / list_pins / delete_pin — fast quick-capture sticky notes for fleeting thoughts.',
    '- Rugby: log sessions (games/training with metrics), add/update skill levels.',
    '- Projects: create, log work on, update, delete. Priorities: create/check/delete. Improvements: list, create, add & complete actions, set progress. The "I\'m Bored" list: add/list/complete/delete. The Inbox: annotate emails, manage the reply queue.',
    'When the user names an existing thing, find it by a title/name fragment (the tools match loosely). Prefer the specific tool; only ask to clarify if genuinely ambiguous.',
    '',
    'Inference & reasoning: figure out which area a request belongs to and act, even when phrased loosely. Talk of reps, sets, weight, "I just did", a lift/exercise name, or "add to my workout" is the GYM — log it. Times/meetings/appointments are the SCHEDULE. "remind me/I need to" is a TASK. Resolve names to the closest existing item (e.g. an exercise the user already has) instead of creating duplicates; only create new when nothing close exists. Carry context across the conversation — if the user just logged "leg press" and then says "add another set" or "make it 12.5kg", they mean that same exercise.',
    '',
    'Logging gym sets — CRITICAL: when the user gives a SET COUNT (e.g. "3 sets of 10", "5x5 at 100kg", "leg press 5 sets of 10 reps 12.5kg"), make exactly ONE call to log_sets with sets = that number. Do NOT call log_set in a loop and do NOT create more sets than asked — "3 sets" means exactly 3, "5 sets" means exactly 5. Use log_set only for a single one-off set.',
    '',
    'How to handle common requests:',
    '- "schedule time to do X" → check get_schedule or find_free_slot for an open gap (working hours 08:00–22:00 unless told otherwise), then schedule_event at that slot with a sensible duration. By DEFAULT events land on the Yahoo Google calendar (and show in the app) — only pass calendar="yale"/"rotunda" when the user names that calendar, or calendar="local" if they say keep it in the app only.',
    '- "clear my schedule (for a day)" → call get_schedule for that day, then clear_day. NEVER re-create events to clear them.',
    '- "delete/clear all my X events" or "remove every X on <account>, every day" → ONE call to delete_events with query (and account/date range if given). Do NOT loop day-by-day or call clear_day repeatedly.',
    '- "move / reschedule X" → get_schedule to find its id, then reschedule_event. Do not delete-and-recreate.',
    '- "remind me / add a task to …" → create_task, with a due_date if a time is implied and a priority if it sounds important.',
    '- "make X urgent / high priority" → set_task_priority.',
    '- "I want to look into X later" → add_to_bored_list.',
    '',
    'Use local datetimes like 2026-06-09T15:00:00 (no timezone suffix). Keep replies short and friendly, and confirm what you did in a sentence or two. Reply in plain text — no markdown.',
  ].join('\n')
}

function toLangChainMessages(history) {
  return history.map((m) => (m.role === 'assistant' ? new AIMessage(m.content) : new HumanMessage(m.content)))
}

/**
 * Run one assistant turn over the conversation so far.
 * Returns the reply text plus the list of actions it performed.
 */
export async function runAssistant(history) {
  if (!assistantConfigured()) {
    return { configured: false, actions: [], reply: 'Add an OPENAI_API_KEY to your .env to enable the assistant.' }
  }

  const actions = []
  const tools = buildTools((line) => actions.push(line))
  const model = new ChatOpenAI({
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    temperature: 0,
    apiKey: process.env.OPENAI_API_KEY,
  })

  const agent = createReactAgent({ llm: model, tools })
  const messages = [new SystemMessage(systemPrompt()), ...toLangChainMessages(history)]
  try {
    const result = await agent.invoke({ messages }, { recursionLimit: 60 })
    return { configured: true, actions, reply: extractReply(result.messages) }
  } catch (err) {
    // Never bubble a 500 to the chat — return whatever we managed, plus a note.
    const note = actions.length
      ? `I did ${actions.length} thing${actions.length === 1 ? '' : 's'} but then hit a snag: ${err.message}. Want me to keep going?`
      : `Sorry — I ran into a problem with that: ${err.message}. Try narrowing it down or rephrasing.`
    return { configured: true, actions, reply: note }
  }
}

// The final answer is the last AI message; its content may be a string or an
// array of content blocks depending on the model — normalise to plain text.
function extractReply(messages) {
  const content = messages.at(-1)?.content
  if (typeof content === 'string') return content || 'Done.'
  if (Array.isArray(content)) {
    return content.map((part) => (typeof part === 'string' ? part : part?.text || '')).join('') || 'Done.'
  }
  return 'Done.'
}
