import { tool } from '@langchain/core/tools'
import { z } from 'zod'
import { db } from '../../db/index.js'
import { newId, now, localDateStr } from '../helpers.js'

export function buildRugbyTools({ record }) {
  const logRugbySession = tool(
    async ({ date, type, opponent, position, rating, metrics, notes }) => {
      const id = newId()
      const ts = now()
      const sessionDate = date || localDateStr()
      const sessionType = type || 'training'
      const metricsStr = JSON.stringify(metrics || {})
      await db
        .prepare(
          `INSERT INTO rugby_sessions (id, date, type, opponent, position, rating, metrics, notes, created_at, updated_at)
           VALUES (@id, @date, @type, @opponent, @position, @rating, @metrics, @notes, @ts, @ts)`,
        )
        .run({
          id,
          date: sessionDate,
          type: sessionType,
          opponent: opponent || null,
          position: position || null,
          rating: rating || null,
          metrics: metricsStr,
          notes: notes || null,
          ts,
        })
      record(`🏉 Logged ${sessionType} session`)
      return JSON.stringify({ ok: true, id, date: sessionDate, type: sessionType })
    },
    {
      name: 'log_rugby_session',
      description: 'Log a rugby session (game or training). Defaults: date=today, type=training.',
      schema: z.object({
        date: z.string().optional().describe('YYYY-MM-DD; omit for today'),
        type: z.enum(['game', 'training']).optional().describe('default: training'),
        opponent: z.string().optional().describe('opponent team name (for games)'),
        position: z.string().optional(),
        rating: z.number().int().min(1).max(10).optional().describe('self-rating 1–10'),
        metrics: z
          .object({
            tackles: z.number().optional(),
            tries: z.number().optional(),
            meters: z.number().optional(),
            minutes: z.number().optional(),
          })
          .catchall(z.number())
          .optional()
          .describe('performance metrics object'),
        notes: z.string().optional(),
      }),
    },
  )

  const listRugbySessions = tool(
    async () => {
      const rows = await db
        .prepare(
          'SELECT id, date, type, opponent, rating FROM rugby_sessions ORDER BY date DESC, created_at DESC LIMIT 10',
        )
        .all()
      return JSON.stringify(rows)
    },
    {
      name: 'list_rugby_sessions',
      description: 'List the 10 most recent rugby sessions (id, date, type, opponent, rating).',
      schema: z.object({}),
    },
  )

  const addRugbySkill = tool(
    async ({ name, current_level, target_level }) => {
      const id = newId()
      const ts = now()
      const maxRow = await db.prepare('SELECT COALESCE(MAX(sort_order), -1) AS m FROM rugby_skills').get()
      const sortOrder = Number(maxRow.m) + 1
      await db
        .prepare(
          `INSERT INTO rugby_skills (id, name, current_level, target_level, notes, sort_order, created_at, updated_at)
           VALUES (@id, @name, @currentLevel, @targetLevel, NULL, @sortOrder, @ts, @ts)`,
        )
        .run({
          id,
          name,
          currentLevel: current_level || 3,
          targetLevel: target_level || 8,
          sortOrder,
          ts,
        })
      record(`🏉 Added skill "${name}"`)
      return JSON.stringify({ ok: true, id, name, current_level: current_level || 3, target_level: target_level || 8 })
    },
    {
      name: 'add_rugby_skill',
      description: 'Add a new rugby skill to track. Defaults: current_level=3, target_level=8.',
      schema: z.object({
        name: z.string(),
        current_level: z.number().int().min(1).max(10).optional().describe('default 3'),
        target_level: z.number().int().min(1).max(10).optional().describe('default 8'),
      }),
    },
  )

  const updateRugbySkill = tool(
    async ({ name, current_level }) => {
      const skill = await db
        .prepare('SELECT id, name FROM rugby_skills WHERE name ILIKE ? ORDER BY created_at DESC LIMIT 1')
        .get(`%${name}%`)
      if (!skill) return JSON.stringify({ ok: false, message: `No rugby skill matching "${name}".` })
      const clamped = Math.min(10, Math.max(1, current_level))
      await db
        .prepare('UPDATE rugby_skills SET current_level = @level, updated_at = @ts WHERE id = @id')
        .run({ level: clamped, ts: now(), id: skill.id })
      record(`📈 Updated skill "${skill.name}"`)
      return JSON.stringify({ ok: true, id: skill.id, name: skill.name, current_level: clamped })
    },
    {
      name: 'update_rugby_skill',
      description: 'Update the current_level (1–10) of an existing rugby skill, found by a fragment of its name.',
      schema: z.object({
        name: z.string().describe('fragment of the skill name'),
        current_level: z.number().int().min(1).max(10),
      }),
    },
  )

  const updateRugbySession = tool(
    async ({ session_id, date, type, opponent, position, rating, notes }) => {
      let session
      if (session_id) {
        session = await db.prepare('SELECT id, date FROM rugby_sessions WHERE id = ?').get(session_id)
      } else if (date) {
        session = await db.prepare('SELECT id, date FROM rugby_sessions WHERE date = ? ORDER BY created_at DESC LIMIT 1').get(date)
      } else {
        return JSON.stringify({ ok: false, message: 'Provide session_id or date.' })
      }
      if (!session) return JSON.stringify({ ok: false, message: 'No matching rugby session.' })
      const sets = []
      const p = { id: session.id, ts: now() }
      if (type !== undefined) { sets.push('type = @type'); p.type = type }
      if (opponent !== undefined) { sets.push('opponent = @opponent'); p.opponent = opponent }
      if (position !== undefined) { sets.push('position = @position'); p.position = position }
      if (rating !== undefined) { sets.push('rating = @rating'); p.rating = rating }
      if (notes !== undefined) { sets.push('notes = @notes'); p.notes = notes }
      if (!sets.length) return JSON.stringify({ ok: false, message: 'Nothing to update.' })
      await db.prepare(`UPDATE rugby_sessions SET ${sets.join(', ')}, updated_at = @ts WHERE id = @id`).run(p)
      record(`✏️ Updated rugby session`)
      return JSON.stringify({ ok: true, id: session.id })
    },
    {
      name: 'update_rugby_session',
      description: 'Edit a rugby session by id (from list_rugby_sessions) or by date (most recent that day).',
      schema: z.object({
        session_id: z.string().optional(),
        date: z.string().optional().describe('YYYY-MM-DD'),
        type: z.enum(['game', 'training']).optional(),
        opponent: z.string().optional(),
        position: z.string().optional(),
        rating: z.number().int().min(1).max(10).optional(),
        notes: z.string().optional(),
      }),
    },
  )

  const deleteRugbySession = tool(
    async ({ session_id, date }) => {
      let session
      if (session_id) {
        session = await db.prepare('SELECT id FROM rugby_sessions WHERE id = ?').get(session_id)
      } else if (date) {
        session = await db.prepare('SELECT id FROM rugby_sessions WHERE date = ? ORDER BY created_at DESC LIMIT 1').get(date)
      } else {
        return JSON.stringify({ ok: false, message: 'Provide session_id or date.' })
      }
      if (!session) return JSON.stringify({ ok: false, message: 'No matching rugby session.' })
      await db.prepare('DELETE FROM rugby_sessions WHERE id = ?').run(session.id)
      record(`🗑️ Deleted rugby session`)
      return JSON.stringify({ ok: true, id: session.id })
    },
    {
      name: 'delete_rugby_session',
      description: 'Delete a rugby session by id or by date (most recent that day).',
      schema: z.object({
        session_id: z.string().optional(),
        date: z.string().optional().describe('YYYY-MM-DD'),
      }),
    },
  )

  const listRugbySkills = tool(
    async () => {
      const rows = await db.prepare('SELECT id, name, current_level, target_level FROM rugby_skills ORDER BY sort_order').all()
      return JSON.stringify(rows)
    },
    {
      name: 'list_rugby_skills',
      description: 'List all tracked rugby skills with current and target levels.',
      schema: z.object({}),
    },
  )

  const deleteRugbySkill = tool(
    async ({ name }) => {
      const skill = await db.prepare('SELECT id, name FROM rugby_skills WHERE name ILIKE ? LIMIT 1').get(`%${name}%`)
      if (!skill) return JSON.stringify({ ok: false, message: `No rugby skill matching "${name}".` })
      await db.prepare('DELETE FROM rugby_skills WHERE id = ?').run(skill.id)
      record(`🗑️ Deleted skill "${skill.name}"`)
      return JSON.stringify({ ok: true, id: skill.id })
    },
    {
      name: 'delete_rugby_skill',
      description: 'Delete a rugby skill from tracking, found by name fragment.',
      schema: z.object({ name: z.string() }),
    },
  )

  return [logRugbySession, listRugbySessions, updateRugbySession, deleteRugbySession, addRugbySkill, listRugbySkills, updateRugbySkill, deleteRugbySkill]
}
