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
    '- Schedule/Calendar: events & timed blocks (schedule/find_free_slot/reschedule/delete/clear_day).',
    '- Tasks: create/update/complete/delete/list, and set priority (low/normal/high/urgent; urgent & high are pinned in the header).',
    '- Gym & Rehab: create exercises, start/finish workouts, and log_set to record a set you just did (it finds or creates today\'s workout and the exercise). Build routines too. You CAN delete: list_workouts then delete_workout (by id, by date, or all:true), plus delete_exercise and delete_routine.',
    '- Notes: create_note (with a heading + content), append_to_note, delete_note — a hierarchical notes workspace.',
    '- Rugby: log sessions (games/training with metrics), add/update skill levels.',
    '- Projects: create, log work on, update, delete; Priorities; Improvements (goals + actions + progress); the "I\'m Bored" list; and the Inbox (annotate emails, manage the reply queue).',
    'When the user names an existing thing, find it by a title/name fragment (the tools match loosely). Prefer the specific tool; only ask to clarify if genuinely ambiguous.',
    '',
    'How to handle common requests:',
    '- "schedule time to do X" → check get_schedule or find_free_slot for an open gap (working hours 08:00–22:00 unless told otherwise), then schedule_event at that slot with a sensible duration.',
    '- "clear my schedule (for a day)" → call get_schedule for that day, then clear_day (or delete_event for specific items). NEVER re-create events to clear them.',
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
  const result = await agent.invoke({ messages })

  return { configured: true, actions, reply: extractReply(result.messages) }
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
