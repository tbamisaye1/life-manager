/**
 * Client-side mirror of server/lib/taskRecurrence.js (parse / serialize / label).
 * Keep in sync when changing the storage format.
 */

const FREQUENCIES = new Set(['single', 'daily', 'weekly', 'monthly', 'yearly'])
export const DOW_NAMES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
export const DOW_LABEL = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
export const RECURRENCE_FREQUENCIES = ['single', 'daily', 'weekly', 'monthly', 'yearly']

function normalizeWeekdays(raw) {
  if (!Array.isArray(raw) || !raw.length) return null
  const out = []
  for (const v of raw) {
    let n = v
    if (typeof v === 'string') {
      const key = v.trim().toLowerCase().slice(0, 3)
      const idx = DOW_NAMES.indexOf(key)
      if (idx < 0) continue
      n = idx
    }
    if (typeof n !== 'number' || !Number.isInteger(n) || n < 0 || n > 6) continue
    if (!out.includes(n)) out.push(n)
  }
  return out.length ? out.sort((a, b) => a - b) : null
}

export function parseRecurrence(value) {
  if (value == null || value === '') return { frequency: 'single', weekdays: null }
  if (typeof value === 'object' && !Array.isArray(value)) {
    const frequency = FREQUENCIES.has(value.frequency) ? value.frequency : 'weekly'
    return { frequency, weekdays: normalizeWeekdays(value.weekdays ?? value.days_of_week) }
  }
  if (typeof value !== 'string') return { frequency: 'single', weekdays: null }
  const trimmed = value.trim()
  if (FREQUENCIES.has(trimmed)) return { frequency: trimmed, weekdays: null }
  if (trimmed.startsWith('{')) {
    try {
      return parseRecurrence(JSON.parse(trimmed))
    } catch {
      return { frequency: 'single', weekdays: null }
    }
  }
  const m = trimmed.match(/^(daily|weekly|monthly|yearly):(.+)$/i)
  if (m) {
    return { frequency: m[1].toLowerCase(), weekdays: normalizeWeekdays(m[2].split(/[,\s]+/).filter(Boolean)) }
  }
  return { frequency: 'single', weekdays: null }
}

export function serializeRecurrence(input) {
  const { frequency, weekdays } = parseRecurrence(input)
  if (frequency === 'single' || !frequency) return 'single'
  if (!weekdays?.length) return frequency
  return JSON.stringify({ frequency, weekdays })
}

export function formatRecurrenceLabel(value) {
  const { frequency, weekdays } = parseRecurrence(value)
  if (frequency === 'single') return null
  const freqLabel = frequency[0].toUpperCase() + frequency.slice(1)
  if (!weekdays?.length) return freqLabel
  return `${freqLabel} · ${weekdays.map((d) => DOW_LABEL[d]).join(', ')}`
}
