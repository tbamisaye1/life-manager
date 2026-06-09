import { tool } from '@langchain/core/tools'
import { z } from 'zod'
import { db } from '../../db/index.js'
import { newId, now } from '../helpers.js'
import { textToTiptap } from './tools-shared.js'

export function buildNotesTools({ record }) {
  const listNotes = tool(
    async () => {
      const rows = await db
        .prepare('SELECT id, title, parent_id FROM pages WHERE archived = 0 ORDER BY sort_order, created_at')
        .all()
      return JSON.stringify(rows)
    },
    {
      name: 'list_notes',
      description: 'List all non-archived notes/pages (id, title, parent_id) so the agent can find and target specific notes.',
      schema: z.object({}),
    },
  )

  const createNote = tool(
    async ({ title, content, parent_title }) => {
      let parentId = null
      if (parent_title) {
        const parent = await db
          .prepare('SELECT id FROM pages WHERE title ILIKE ? AND archived = 0 ORDER BY created_at DESC LIMIT 1')
          .get(`%${parent_title}%`)
        parentId = parent?.id ?? null
      }
      const maxRow = await db.prepare('SELECT COALESCE(MAX(sort_order), -1) AS m FROM pages').get()
      const sortOrder = Number(maxRow.m) + 1
      const id = newId()
      const ts = now()
      const body = textToTiptap(content || '')
      await db
        .prepare(
          `INSERT INTO pages (id, parent_id, title, icon, color, body, is_focus, sort_order, archived, created_at, updated_at)
           VALUES (@id, @parentId, @title, '📝', NULL, @body, 0, @sortOrder, 0, @ts, @ts)`,
        )
        .run({ id, parentId, title, body, sortOrder, ts })
      record(`📝 Wrote note "${title}"`)
      return JSON.stringify({ ok: true, id, title })
    },
    {
      name: 'create_note',
      description: 'Create a new note/page with a title and optional content. Optionally nest it under a parent page by parent_title.',
      schema: z.object({
        title: z.string(),
        content: z.string().optional().describe('plain text; supports "# heading" and "- bullet" lines'),
        parent_title: z.string().optional().describe('title fragment of the parent page to nest under'),
      }),
    },
  )

  const appendToNote = tool(
    async ({ title, content }) => {
      const page = await db
        .prepare('SELECT id, title, body FROM pages WHERE title ILIKE ? AND archived = 0 ORDER BY created_at DESC LIMIT 1')
        .get(`%${title}%`)
      if (!page) return JSON.stringify({ ok: false, message: `No note matching "${title}".` })

      let doc
      try {
        doc = JSON.parse(page.body)
        if (!doc || !Array.isArray(doc.content)) throw new Error('invalid')
      } catch {
        doc = { type: 'doc', content: [{ type: 'paragraph' }] }
      }

      const newNodes = JSON.parse(textToTiptap(content)).content
      doc.content = [...doc.content, ...newNodes]

      await db
        .prepare('UPDATE pages SET body = @body, updated_at = @ts WHERE id = @id')
        .run({ body: JSON.stringify(doc), ts: now(), id: page.id })
      record(`📝 Added to "${page.title}"`)
      return JSON.stringify({ ok: true, id: page.id, title: page.title })
    },
    {
      name: 'append_to_note',
      description: 'Append content to an existing note found by a fragment of its title.',
      schema: z.object({
        title: z.string().describe('fragment of the note title'),
        content: z.string().describe('plain text to append; supports "# heading" and "- bullet" lines'),
      }),
    },
  )

  const updateNote = tool(
    async ({ title, new_title, content }) => {
      const page = await db
        .prepare('SELECT id, title FROM pages WHERE title ILIKE ? AND archived = 0 ORDER BY created_at DESC LIMIT 1')
        .get(`%${title}%`)
      if (!page) return JSON.stringify({ ok: false, message: `No note matching "${title}".` })
      const sets = []
      const p = { id: page.id, ts: now() }
      if (new_title !== undefined) { sets.push('title = @title'); p.title = new_title }
      if (content !== undefined) { sets.push('body = @body'); p.body = textToTiptap(content) }
      if (!sets.length) return JSON.stringify({ ok: false, message: 'Nothing to update (pass new_title and/or content).' })
      await db.prepare(`UPDATE pages SET ${sets.join(', ')}, updated_at = @ts WHERE id = @id`).run(p)
      record(`✏️ Updated note "${new_title || page.title}"`)
      return JSON.stringify({ ok: true, id: page.id, title: new_title || page.title })
    },
    {
      name: 'update_note',
      description: 'Rename a note and/or REPLACE its entire content (found by title fragment). To add without replacing, use append_to_note instead.',
      schema: z.object({
        title: z.string().describe('fragment of the note title to find it'),
        new_title: z.string().optional(),
        content: z.string().optional().describe('new full content; supports "# heading" and "- bullet" lines'),
      }),
    },
  )

  const deleteNote = tool(
    async ({ title }) => {
      const page = await db
        .prepare('SELECT id, title FROM pages WHERE title ILIKE ? AND archived = 0 ORDER BY created_at DESC LIMIT 1')
        .get(`%${title}%`)
      if (!page) return JSON.stringify({ ok: false, message: `No note matching "${title}".` })
      await db.prepare('DELETE FROM pages WHERE id = ?').run(page.id)
      record(`🗑️ Deleted note "${page.title}"`)
      return JSON.stringify({ ok: true, id: page.id, title: page.title })
    },
    {
      name: 'delete_note',
      description: 'Delete a note (and all its subpages) by a fragment of its title.',
      schema: z.object({
        title: z.string().describe('fragment of the note title to delete'),
      }),
    },
  )

  return [listNotes, createNote, appendToNote, updateNote, deleteNote]
}
