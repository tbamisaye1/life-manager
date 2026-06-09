import { tool } from '@langchain/core/tools'
import { z } from 'zod'
import { db } from '../../db/index.js'
import { newId, now } from '../helpers.js'

export function buildPinsTools({ record }) {
  const createPin = tool(
    async ({ body, color, pinned }) => {
      const ts = now()
      const id = newId()
      await db
        .prepare(`INSERT INTO pins (id, body, color, pinned, created_at, updated_at)
          VALUES (@id, @body, @color, @pinned, @ts, @ts)`)
        .run({ id, body, color: color || 'amber', pinned: pinned ? 1 : 0, ts })
      record(`📌 Pinned "${body.length > 40 ? body.slice(0, 40) + '…' : body}"`)
      return JSON.stringify({ ok: true, id })
    },
    {
      name: 'create_pin',
      description: 'Add a quick note to the pinboard — for fleeting thoughts, reminders, or ideas the user wants to capture fast.',
      schema: z.object({
        body: z.string().describe('the note text'),
        color: z.enum(['amber', 'blue', 'emerald', 'rose', 'violet', 'teal', 'orange', 'slate']).optional(),
        pinned: z.boolean().optional().describe('pin to the top'),
      }),
    },
  )

  const listPins = tool(
    async () => {
      const rows = await db.prepare('SELECT id, body, color, pinned FROM pins ORDER BY pinned DESC, created_at DESC LIMIT 50').all()
      return JSON.stringify({ ok: true, pins: rows })
    },
    { name: 'list_pins', description: 'List pinboard notes (pinned first, then newest). Use before editing/deleting a pin.', schema: z.object({}) },
  )

  const deletePin = tool(
    async ({ text }) => {
      const pin = await db.prepare('SELECT id, body FROM pins WHERE body ILIKE ? ORDER BY created_at DESC LIMIT 1').get(`%${text}%`)
      if (!pin) return JSON.stringify({ ok: false, message: `No pin matching "${text}".` })
      await db.prepare('DELETE FROM pins WHERE id = ?').run(pin.id)
      record(`🗑️ Deleted pin`)
      return JSON.stringify({ ok: true, id: pin.id })
    },
    {
      name: 'delete_pin',
      description: 'Delete a pinboard note found by a fragment of its text.',
      schema: z.object({ text: z.string().describe('fragment of the pin text') }),
    },
  )

  return [createPin, listPins, deletePin]
}
