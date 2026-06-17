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
    '- Schedule/Calendar: schedule_event (one-off; flagship=true for month-calendar events — always app-local), schedule_recurring_event (repeating), find_events (search by title across all days — use BEFORE any delete), list_flagship_events (month overview), get_schedule (one day only), update_event, reschedule_event, delete_event (by id from find_events), delete_events (bulk — narrow with date range), delete_event_series, find_free_slot, clear_day.',
    '- Tasks: create/update/complete/delete/list — including notes/description, recurrence, project, and priority (low/normal/high/urgent; urgent & high are pinned in the header).',
    '- Gym & Rehab: log_exercise (log today\'s sets), set_exercise_goal (change library target/standard — "5x10@20kg", NOT a workout log), resolve_exercise, update_exercise, log_sets, log_set, update_set, delete_set, clear_exercise_sets, create/delete exercises, start/finish/update/delete workouts. get_gym_today shows per-set detail. list_exercises lists the library.',
    '- Notes: create_note, append_to_note, update_note (rename/replace), delete_note — a hierarchical notes workspace.',
    '- Pinboard: create_pin / list_pins / update_pin / delete_pin — fast quick-capture sticky notes for fleeting thoughts.',
    '- Rugby: log/update/delete sessions, list sessions, add/update/delete skill levels.',
    '- Projects: create, log work on, update, delete. Priorities: create/update/check/delete. Improvements: list/create/update/delete, list/add/complete/delete actions, set progress. The "I\'m Bored" list: add/list/update/complete/delete. The Inbox: annotate emails, manage the reply queue (add/update/done/delete).',
    'When the user names an existing thing, find it by a title/name fragment (the tools match loosely). Prefer the specific tool; only ask to clarify if genuinely ambiguous.',
    '',
    'Flagship / month-calendar events — CRITICAL: when the user asks for a "flagship event" or something on the month calendar, call schedule_event or schedule_recurring_event with flagship=true. That keeps it app-local automatically (never Yahoo/Google). After creating or editing flagship events, they appear on the month Calendar view (flagship=1). Timed schedule blocks without "flagship" go on Yahoo by default and show on the daily schedule only.',
    '',
    'Deleting events — CRITICAL: NEVER guess event ids from get_schedule (one day, easy to confuse similar titles). ALWAYS call find_events with the title fragment (and date range if known) first, then delete_event with the exact id. If find_events returns multiple matches, ask the user or narrow with from/to dates — do NOT delete unrelated events. Prefer delete_event (one id) over delete_events (bulk).',
    'Inference & reasoning: figure out which area a request belongs to and act, even when phrased loosely. Talk of reps, sets, weight, "I just did", a lift/exercise name, or "add to my workout" is the GYM — log it. Times/meetings/appointments are the SCHEDULE. "remind me/I need to" is a TASK. For gym exercises, call list_exercises or get_gym_today first when the name might already exist — match the closest existing exercise (hyphens/spaces/capitalisation differ) instead of creating duplicates; only create new when nothing close exists. Carry context across the conversation — if the user just logged "leg press" and then says "add another set" or "make it 12.5kg", they mean that same exercise.',
    '',
    'Gym goals vs logging — CRITICAL: "goal", "target", "standard", "I want to hit", "new goal: 5x10@20kg" → set_exercise_goal (updates the exercise library: sets, reps, target weight). "I just did", "log", "add to workout" → log_exercise (today\'s actual sets). Never confuse the two.',
    '',
    'Gym notation — how users talk (sets×reps first): "5x10@20kg" = 5 sets of 10 reps at 20kg → log_exercise(exercise_name, notation:"5x10@20kg") for logging, or set_exercise_goal(exercise_name, goal:"5x10@20kg") for targets. Also: "3x6 at 30kg", "4 sets of 5". Mixed weights when logging: groups:[{notation:"3x10@12.5kg"},{notation:"2x10@20kg"}]. ALWAYS use log_exercise (one call) — never loop log_set. When correcting logged sets ("change to 5x5"), use replace:true. Pass the FULL exercise name.',
    '',
    'Logging gym sets — CRITICAL: when the user gives a set COUNT, make exactly ONE log_exercise or log_sets call with the exact count. Do NOT call log_set in a loop. When the user wants to CHANGE an exercise\'s sets, use replace:true so old sets are cleared first — otherwise sets stack up (e.g. 5 old + 5 new = 10).',
    '',
    'Fixing gym mistakes — CRITICAL: to remove a wrong/duplicate entry from today\'s workout, use clear_exercise_sets for that exercise name — do NOT delete_workout (that wipes the whole session) and do NOT delete_exercise (that removes the exercise from the library everywhere). Only delete_exercise when the user explicitly wants the exercise definition gone forever. When removing one duplicate, clear only the wrong exercise — keep the correct one.',
    '',
    'How to handle common requests:',
    '- "schedule time to do X" → check get_schedule or find_free_slot for an open gap (working hours 08:00–22:00 unless told otherwise), then schedule_event at that slot with a sensible duration. By DEFAULT events land on the Yahoo Google calendar (and show in the app) — only pass calendar="yale"/"rotunda" when the user names that calendar, or calendar="local" if they say keep it in the app only.',
    '- "clear my schedule (for a day)" → call get_schedule for that day, then clear_day. NEVER re-create events to clear them.',
    '- "delete/clear all my X events" or "remove every X on <account>, every day" → ONE call to delete_events with query (and account/date range if given). Do NOT loop day-by-day or call clear_day repeatedly.',
    '- "move / reschedule X" → find_events to get its id, then reschedule_event. Do not delete-and-recreate.',
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
