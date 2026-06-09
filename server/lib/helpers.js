import { nanoid } from 'nanoid'

/** Generate a short unique id. */
export const newId = () => nanoid(12)

/** Current ISO timestamp. Centralized so call sites stay clean. */
export const now = () => new Date().toISOString()

/**
 * Coerce SQLite integer flags (0/1) to booleans on the way out, for a set of
 * known boolean columns. Keeps the API returning real JSON booleans.
 */
export function decodeBooleans(row, boolFields = []) {
  if (!row) return row
  const out = { ...row }
  for (const f of boolFields) {
    if (f in out) out[f] = !!out[f]
  }
  return out
}

export const mapRows = (rows, boolFields = []) =>
  rows.map((r) => decodeBooleans(r, boolFields))

/** Build a parameterized partial UPDATE from an allowed field list. */
export function buildUpdate(table, id, patch, allowed) {
  const keys = Object.keys(patch).filter((k) => allowed.includes(k))
  if (keys.length === 0) return null
  const sets = keys.map((k) => `"${k}" = @${k}`).join(', ')
  const params = {}
  for (const k of keys) params[k] = patch[k]
  params.id = id
  params.updated_at = new Date().toISOString()
  return {
    sql: `UPDATE ${table} SET ${sets}, updated_at = @updated_at WHERE id = @id`,
    params,
  }
}
