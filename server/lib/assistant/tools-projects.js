import { tool } from '@langchain/core/tools'
import { z } from 'zod'
import { db } from '../../db/index.js'
import { newId, now } from '../helpers.js'

export function buildProjectTools({ record }) {
  const listProjects = tool(
    async () => {
      const rows = await db
        .prepare('SELECT id, name, short_code, last_worked_at FROM projects WHERE archived = 0 ORDER BY name')
        .all()
      return JSON.stringify(rows)
    },
    {
      name: 'list_projects',
      description: 'List all non-archived projects: id, name, short_code, last_worked_at.',
      schema: z.object({}),
    },
  )

  const createProject = tool(
    async ({ name, short_code, emoji, color, description }) => {
      const ts = now()
      const id = newId()
      await db
        .prepare(
          `INSERT INTO projects (id, name, short_code, color, emoji, description, last_worked_at, archived, created_at, updated_at)
           VALUES (@id, @name, @short_code, @color, @emoji, @description, NULL, 0, @ts, @ts)`,
        )
        .run({
          id,
          name,
          short_code: short_code || null,
          color: color || 'slate',
          emoji: emoji || '📁',
          description: description || '',
          ts,
        })
      record(`🆕 Created project "${name}"`)
      return JSON.stringify({ ok: true, id, name })
    },
    {
      name: 'create_project',
      description: 'Create a new project. Defaults: emoji 📁, color slate.',
      schema: z.object({
        name: z.string(),
        short_code: z.string().optional(),
        emoji: z.string().optional(),
        color: z.string().optional(),
        description: z.string().optional(),
      }),
    },
  )

  const logProjectWork = tool(
    async ({ name }) => {
      const row = await db
        .prepare('SELECT id, name FROM projects WHERE (name ILIKE ? OR short_code ILIKE ?) AND archived = 0 LIMIT 1')
        .get(`%${name}%`, `%${name}%`)
      if (!row) return JSON.stringify({ ok: false, message: `No project matching "${name}".` })
      const ts = now()
      await db
        .prepare('UPDATE projects SET last_worked_at = @ts, updated_at = @ts WHERE id = @id')
        .run({ ts, id: row.id })
      record(`✅ Logged work on "${row.name}"`)
      return JSON.stringify({ ok: true, id: row.id, name: row.name, last_worked_at: ts })
    },
    {
      name: 'log_project_work',
      description: 'Mark a project as worked on right now (updates last_worked_at). Resolves by name or short_code.',
      schema: z.object({
        name: z.string().describe('project name or short_code fragment'),
      }),
    },
  )

  const updateProject = tool(
    async ({ name, new_name, description, color, emoji }) => {
      const row = await db
        .prepare('SELECT id, name FROM projects WHERE (name ILIKE ? OR short_code ILIKE ?) AND archived = 0 LIMIT 1')
        .get(`%${name}%`, `%${name}%`)
      if (!row) return JSON.stringify({ ok: false, message: `No project matching "${name}".` })

      const sets = []
      const params = { id: row.id, ts: now() }
      if (new_name !== undefined) { sets.push('name = @new_name'); params.new_name = new_name }
      if (description !== undefined) { sets.push('description = @description'); params.description = description }
      if (color !== undefined) { sets.push('color = @color'); params.color = color }
      if (emoji !== undefined) { sets.push('emoji = @emoji'); params.emoji = emoji }

      if (sets.length === 0) return JSON.stringify({ ok: false, message: 'No fields to update.' })

      await db
        .prepare(`UPDATE projects SET ${sets.join(', ')}, updated_at = @ts WHERE id = @id`)
        .run(params)
      const updated = new_name || row.name
      record(`✏️ Updated project "${updated}"`)
      return JSON.stringify({ ok: true, id: row.id, name: updated })
    },
    {
      name: 'update_project',
      description: 'Update one or more fields on a project (name, description, color, emoji). Resolves by current name or short_code.',
      schema: z.object({
        name: z.string().describe('current project name or short_code fragment'),
        new_name: z.string().optional(),
        description: z.string().optional(),
        color: z.string().optional(),
        emoji: z.string().optional(),
      }),
    },
  )

  const deleteProject = tool(
    async ({ name }) => {
      const row = await db
        .prepare('SELECT id, name FROM projects WHERE (name ILIKE ? OR short_code ILIKE ?) AND archived = 0 LIMIT 1')
        .get(`%${name}%`, `%${name}%`)
      if (!row) return JSON.stringify({ ok: false, message: `No project matching "${name}".` })
      await db.prepare('DELETE FROM projects WHERE id = ?').run(row.id)
      record(`🗑️ Deleted project "${row.name}"`)
      return JSON.stringify({ ok: true, id: row.id, name: row.name })
    },
    {
      name: 'delete_project',
      description: 'Permanently delete a project by name or short_code.',
      schema: z.object({
        name: z.string().describe('project name or short_code fragment'),
      }),
    },
  )

  return [listProjects, createProject, logProjectWork, updateProject, deleteProject]
}
