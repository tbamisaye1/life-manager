import { tool } from '@langchain/core/tools'
import { z } from 'zod'
import { db } from '../../db/index.js'
import { newId, now } from '../helpers.js'

export function buildListTools({ record }) {
  // ── Priorities ──────────────────────────────────────────────────────────────

  const listPriorities = tool(
    async () => {
      const rows = await db
        .prepare('SELECT id, title, cadence FROM priorities WHERE active = 1 ORDER BY sort_order')
        .all()
      return JSON.stringify(rows)
    },
    {
      name: 'list_priorities',
      description: 'List all active priorities: id, title, cadence.',
      schema: z.object({}),
    },
  )

  const createPriority = tool(
    async ({ title, cadence }) => {
      const ts = now()
      const id = newId()
      const maxRow = await db.prepare('SELECT COALESCE(MAX(sort_order), -1) AS m FROM priorities').get()
      const ord = Number(maxRow.m) + 1
      await db
        .prepare(
          `INSERT INTO priorities (id, title, cadence, emoji, sort_order, last_done_at, active, body, created_at, updated_at)
           VALUES (@id, @title, @cadence, '✅', @ord, NULL, 1, '', @ts, @ts)`,
        )
        .run({ id, title, cadence: cadence || 'daily', ord, ts })
      record(`✅ Added priority "${title}"`)
      return JSON.stringify({ ok: true, id, title, cadence: cadence || 'daily' })
    },
    {
      name: 'create_priority',
      description: 'Add a new active priority. cadence defaults to "daily".',
      schema: z.object({
        title: z.string(),
        cadence: z.enum(['daily', 'weekly']).optional(),
      }),
    },
  )

  const checkPriority = tool(
    async ({ title }) => {
      const row = await db
        .prepare('SELECT id, title FROM priorities WHERE title ILIKE ? AND active = 1 LIMIT 1')
        .get(`%${title}%`)
      if (!row) return JSON.stringify({ ok: false, message: `No active priority matching "${title}".` })
      const ts = now()
      await db
        .prepare('UPDATE priorities SET last_done_at = @ts, updated_at = @ts WHERE id = @id')
        .run({ ts, id: row.id })
      record(`✅ Checked off "${row.title}"`)
      return JSON.stringify({ ok: true, id: row.id, title: row.title, last_done_at: ts })
    },
    {
      name: 'check_priority',
      description: 'Mark a priority as done right now (updates last_done_at). Finds by title fragment.',
      schema: z.object({
        title: z.string().describe('priority title fragment'),
      }),
    },
  )

  // ── Improvements ────────────────────────────────────────────────────────────

  const createImprovement = tool(
    async ({ title, summary, why, category }) => {
      const ts = now()
      const id = newId()
      await db
        .prepare(
          `INSERT INTO improvements (id, title, emoji, category, summary, body, why, progress, created_at, updated_at)
           VALUES (@id, @title, '🎯', @category, @summary, '', @why, 0, @ts, @ts)`,
        )
        .run({
          id,
          title,
          category: category || 'personal',
          summary: summary || '',
          why: why || '',
          ts,
        })
      record(`🎯 Added goal "${title}"`)
      return JSON.stringify({ ok: true, id, title })
    },
    {
      name: 'create_improvement',
      description: 'Add a new improvement goal. Defaults: emoji 🎯, category "personal", progress 0.',
      schema: z.object({
        title: z.string(),
        summary: z.string().optional(),
        why: z.string().optional(),
        category: z.string().optional(),
      }),
    },
  )

  const addImprovementAction = tool(
    async ({ improvement_title, text }) => {
      const imp = await db
        .prepare('SELECT id, title FROM improvements WHERE title ILIKE ? LIMIT 1')
        .get(`%${improvement_title}%`)
      if (!imp) return JSON.stringify({ ok: false, message: `No improvement matching "${improvement_title}".` })
      const ts = now()
      const id = newId()
      await db
        .prepare(
          `INSERT INTO improvement_actions (id, improvement_id, text, done, created_at)
           VALUES (@id, @improvement_id, @text, 0, @ts)`,
        )
        .run({ id, improvement_id: imp.id, text, ts })
      record(`➕ Added action to "${imp.title}"`)
      return JSON.stringify({ ok: true, id, improvement_id: imp.id, text })
    },
    {
      name: 'add_improvement_action',
      description: 'Add an action step to an improvement goal, found by title fragment.',
      schema: z.object({
        improvement_title: z.string().describe('improvement title fragment'),
        text: z.string().describe('action step text'),
      }),
    },
  )

  const setImprovementProgress = tool(
    async ({ title, progress }) => {
      const row = await db
        .prepare('SELECT id, title FROM improvements WHERE title ILIKE ? LIMIT 1')
        .get(`%${title}%`)
      if (!row) return JSON.stringify({ ok: false, message: `No improvement matching "${title}".` })
      const clamped = Math.min(100, Math.max(0, Number(progress)))
      const ts = now()
      await db
        .prepare('UPDATE improvements SET progress = @progress, updated_at = @ts WHERE id = @id')
        .run({ progress: clamped, ts, id: row.id })
      record(`📈 Updated progress on "${row.title}" to ${clamped}%`)
      return JSON.stringify({ ok: true, id: row.id, title: row.title, progress: clamped })
    },
    {
      name: 'set_improvement_progress',
      description: 'Set the progress (0–100) on an improvement goal, found by title fragment.',
      schema: z.object({
        title: z.string().describe('improvement title fragment'),
        progress: z.number().int().min(0).max(100),
      }),
    },
  )

  // ── Bored list ───────────────────────────────────────────────────────────────

  const addToBoredList = tool(
    async ({ title, category }) => {
      const ts = now()
      const id = newId()
      const maxRow = await db.prepare('SELECT COALESCE(MAX(sort_order), -1) AS m FROM bored_items').get()
      const ord = Number(maxRow.m) + 1
      await db
        .prepare(
          `INSERT INTO bored_items (id, title, emoji, category, body, done, sort_order, created_at, updated_at)
           VALUES (@id, @title, '💡', @category, '', 0, @ord, @ts, @ts)`,
        )
        .run({ id, title, category: category || 'other', ord, ts })
      record(`💡 Added "${title}" to your Bored list`)
      return JSON.stringify({ ok: true, id, title })
    },
    {
      name: 'add_to_bored_list',
      description: "Add an item to the user's Bored list. category defaults to 'other'.",
      schema: z.object({
        title: z.string(),
        category: z.enum(['learn', 'project', 'improve', 'fun', 'other']).optional(),
      }),
    },
  )

  const listBored = tool(
    async () => {
      const rows = await db
        .prepare('SELECT id, title, category FROM bored_items WHERE done = 0 ORDER BY sort_order')
        .all()
      return JSON.stringify(rows)
    },
    {
      name: 'list_bored',
      description: "List all undone items on the user's Bored list: id, title, category.",
      schema: z.object({}),
    },
  )

  const completeBoredItem = tool(
    async ({ title }) => {
      const row = await db
        .prepare('SELECT id, title FROM bored_items WHERE title ILIKE ? AND done = 0 LIMIT 1')
        .get(`%${title}%`)
      if (!row) return JSON.stringify({ ok: false, message: `No undone bored item matching "${title}".` })
      const ts = now()
      await db
        .prepare('UPDATE bored_items SET done = 1, updated_at = @ts WHERE id = @id')
        .run({ ts, id: row.id })
      record(`✔️ Completed "${row.title}"`)
      return JSON.stringify({ ok: true, id: row.id, title: row.title })
    },
    {
      name: 'complete_bored_item',
      description: "Mark a Bored-list item as done, found by title fragment.",
      schema: z.object({
        title: z.string().describe('bored item title fragment'),
      }),
    },
  )

  return [
    listPriorities,
    createPriority,
    checkPriority,
    createImprovement,
    addImprovementAction,
    setImprovementProgress,
    addToBoredList,
    listBored,
    completeBoredItem,
  ]
}
