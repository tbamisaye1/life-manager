import { db } from '../db/index.js'
import { now } from './helpers.js'

/**
 * Mark a project as worked-on right now. Called whenever the user does
 * something tied to a project (completes a task, logs a session, etc.) so the
 * "have I worked on X lately?" tracker stays accurate automatically.
 */
export function touchProject(projectId) {
  if (!projectId) return
  db.prepare('UPDATE projects SET last_worked_at = ?, updated_at = ? WHERE id = ?')
    .run(now(), now(), projectId)
}
