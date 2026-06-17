import { tool } from '@langchain/core/tools'
import { z } from 'zod'
import { db } from '../../db/index.js'
import { newId, now } from '../helpers.js'

export function buildInboxTools({ record }) {
  // ---------------------------------------------------------------------------
  // Emails
  // ---------------------------------------------------------------------------

  const listEmails = tool(
    async ({ filter }) => {
      let where = ''
      if (filter === 'needs_reply') where = 'WHERE needs_reply = 1'
      else if (filter === 'pinned') where = 'WHERE pinned = 1'
      else if (filter === 'unread') where = 'WHERE is_read = 0'

      const rows = await db
        .prepare(
          `SELECT id, from_name, subject, needs_reply, pinned
           FROM emails ${where}
           ORDER BY received_at DESC
           LIMIT 15`,
        )
        .all()
      return JSON.stringify(rows)
    },
    {
      name: 'list_emails',
      description:
        "List the user's emails, newest first (max 15). Optionally filter to 'needs_reply', 'pinned', or 'unread'.",
      schema: z.object({
        filter: z
          .enum(['needs_reply', 'pinned', 'unread'])
          .optional()
          .describe("Omit to return all emails"),
      }),
    },
  )

  const setEmailReplyNote = tool(
    async ({ subject, note }) => {
      const email = await db
        .prepare(
          `SELECT id, subject FROM emails WHERE subject ILIKE ? ORDER BY received_at DESC LIMIT 1`,
        )
        .get(`%${subject}%`)
      if (!email) return JSON.stringify({ ok: false, message: `No email matching "${subject}".` })

      await db
        .prepare(
          `UPDATE emails SET reply_note = @note, needs_reply = 1, updated_at = @updated_at WHERE id = @id`,
        )
        .run({ note, updated_at: now(), id: email.id })

      record(`✉️ Noted a reply for "${email.subject}"`)
      return JSON.stringify({ ok: true, id: email.id, subject: email.subject })
    },
    {
      name: 'set_email_reply_note',
      description:
        'Attach a reply note to an email found by subject fragment. Marks it as needs_reply.',
      schema: z.object({
        subject: z.string().describe('Fragment of the email subject'),
        note: z.string().describe('What the user wants to reply'),
      }),
    },
  )

  const markEmailReplied = tool(
    async ({ subject }) => {
      const email = await db
        .prepare(
          `SELECT id, subject FROM emails WHERE subject ILIKE ? ORDER BY received_at DESC LIMIT 1`,
        )
        .get(`%${subject}%`)
      if (!email) return JSON.stringify({ ok: false, message: `No email matching "${subject}".` })

      await db
        .prepare(
          `UPDATE emails SET needs_reply = 0, is_read = 1, updated_at = @updated_at WHERE id = @id`,
        )
        .run({ updated_at: now(), id: email.id })

      record(`✅ Marked "${email.subject}" replied`)
      return JSON.stringify({ ok: true, id: email.id, subject: email.subject })
    },
    {
      name: 'mark_email_replied',
      description: 'Mark an email (found by subject fragment) as replied and read.',
      schema: z.object({
        subject: z.string().describe('Fragment of the email subject'),
      }),
    },
  )

  const pinEmail = tool(
    async ({ subject, pinned }) => {
      const email = await db
        .prepare(
          `SELECT id, subject FROM emails WHERE subject ILIKE ? ORDER BY received_at DESC LIMIT 1`,
        )
        .get(`%${subject}%`)
      if (!email) return JSON.stringify({ ok: false, message: `No email matching "${subject}".` })

      const pinnedVal = pinned === false ? 0 : 1
      await db
        .prepare(`UPDATE emails SET pinned = @pinned, updated_at = @updated_at WHERE id = @id`)
        .run({ pinned: pinnedVal, updated_at: now(), id: email.id })

      record(`📌 ${pinnedVal ? 'Pinned' : 'Unpinned'} "${email.subject}"`)
      return JSON.stringify({ ok: true, id: email.id, subject: email.subject, pinned: !!pinnedVal })
    },
    {
      name: 'pin_email',
      description:
        'Pin (or unpin) an email found by subject fragment. Pass pinned=false to unpin.',
      schema: z.object({
        subject: z.string().describe('Fragment of the email subject'),
        pinned: z
          .boolean()
          .optional()
          .describe('true to pin (default), false to unpin'),
      }),
    },
  )

  // ---------------------------------------------------------------------------
  // Reply queue
  // ---------------------------------------------------------------------------

  const listReplies = tool(
    async () => {
      const rows = await db
        .prepare(
          `SELECT id, person, platform, context FROM reply_queue WHERE done = 0 ORDER BY created_at ASC`,
        )
        .all()
      return JSON.stringify(rows)
    },
    {
      name: 'list_replies',
      description: 'List everyone the user still owes a reply to (done=0).',
      schema: z.object({}),
    },
  )

  const addReply = tool(
    async ({ person, platform, context, due_date }) => {
      const id = newId()
      const ts = now()
      await db
        .prepare(
          `INSERT INTO reply_queue (id, person, platform, context, due_date, done, created_at, updated_at)
           VALUES (@id, @person, @platform, @context, @due_date, 0, @ts, @ts)`,
        )
        .run({
          id,
          person,
          platform: platform || 'imessage',
          context: context || null,
          due_date: due_date || null,
          ts,
        })

      record(`💬 Added reply to ${person}`)
      return JSON.stringify({ ok: true, id, person, platform: platform || 'imessage' })
    },
    {
      name: 'add_reply',
      description: 'Add a person to the cross-platform reply queue.',
      schema: z.object({
        person: z.string(),
        platform: z
          .enum(['imessage', 'whatsapp', 'instagram', 'snapchat', 'email', 'other'])
          .optional()
          .describe("Default 'imessage'"),
        context: z.string().optional().describe('What you need to say / why you owe a reply'),
        due_date: z.string().optional().describe('ISO datetime or date if time-sensitive'),
      }),
    },
  )

  const markReplyDone = tool(
    async ({ person }) => {
      const row = await db
        .prepare(
          `SELECT id, person FROM reply_queue WHERE done = 0 AND person ILIKE ? ORDER BY created_at ASC LIMIT 1`,
        )
        .get(`%${person}%`)
      if (!row) return JSON.stringify({ ok: false, message: `No pending reply for "${person}".` })

      await db
        .prepare(`UPDATE reply_queue SET done = 1, updated_at = @updated_at WHERE id = @id`)
        .run({ updated_at: now(), id: row.id })

      record(`✅ Replied to ${row.person}`)
      return JSON.stringify({ ok: true, id: row.id, person: row.person })
    },
    {
      name: 'mark_reply_done',
      description: 'Mark a pending reply as done, matched by person name fragment.',
      schema: z.object({
        person: z.string().describe('Fragment of the person name'),
      }),
    },
  )

  const updateReply = tool(
    async ({ person, new_person, platform, context, due_date, done }) => {
      const row = await db
        .prepare('SELECT id, person FROM reply_queue WHERE person ILIKE ? ORDER BY created_at DESC LIMIT 1')
        .get(`%${person}%`)
      if (!row) return JSON.stringify({ ok: false, message: `No reply entry for "${person}".` })
      const sets = []
      const p = { id: row.id, ts: now() }
      if (new_person !== undefined) { sets.push('person = @person'); p.person = new_person }
      if (platform !== undefined) { sets.push('platform = @platform'); p.platform = platform }
      if (context !== undefined) { sets.push('context = @context'); p.context = context }
      if (due_date !== undefined) { sets.push('due_date = @due_date'); p.due_date = due_date || null }
      if (done !== undefined) { sets.push('done = @done'); p.done = done ? 1 : 0 }
      if (!sets.length) return JSON.stringify({ ok: false, message: 'Nothing to update.' })
      await db.prepare(`UPDATE reply_queue SET ${sets.join(', ')}, updated_at = @ts WHERE id = @id`).run(p)
      record(`✏️ Updated reply to ${new_person || row.person}`)
      return JSON.stringify({ ok: true, id: row.id })
    },
    {
      name: 'update_reply',
      description: 'Edit a reply-queue entry: rename person, change platform/context/due date, or mark done/undone.',
      schema: z.object({
        person: z.string().describe('current person name fragment'),
        new_person: z.string().optional(),
        platform: z.enum(['imessage', 'whatsapp', 'instagram', 'snapchat', 'email', 'other']).optional(),
        context: z.string().optional(),
        due_date: z.string().optional(),
        done: z.boolean().optional(),
      }),
    },
  )

  const deleteReply = tool(
    async ({ person }) => {
      const row = await db
        .prepare('SELECT id, person FROM reply_queue WHERE person ILIKE ? ORDER BY created_at DESC LIMIT 1')
        .get(`%${person}%`)
      if (!row) return JSON.stringify({ ok: false, message: `No reply entry for "${person}".` })
      await db.prepare('DELETE FROM reply_queue WHERE id = ?').run(row.id)
      record(`🗑️ Removed reply to ${row.person}`)
      return JSON.stringify({ ok: true, id: row.id })
    },
    {
      name: 'delete_reply',
      description: 'Remove someone from the reply queue, matched by person name fragment.',
      schema: z.object({ person: z.string() }),
    },
  )

  return [listEmails, setEmailReplyNote, markEmailReplied, pinEmail, listReplies, addReply, updateReply, markReplyDone, deleteReply]
}
