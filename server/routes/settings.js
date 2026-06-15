import { Router } from 'express'
import { db } from '../db/index.js'

const router = Router()
const NAV_LABELS_KEY = 'nav_labels'

async function readNavLabels() {
  const row = await db.prepare('SELECT value FROM app_settings WHERE key = ?').get(NAV_LABELS_KEY)
  if (!row?.value) return { items: {}, sections: {} }
  try {
    const parsed = JSON.parse(row.value)
    return {
      items: parsed.items && typeof parsed.items === 'object' ? parsed.items : {},
      sections: parsed.sections && typeof parsed.sections === 'object' ? parsed.sections : {},
    }
  } catch {
    return { items: {}, sections: {} }
  }
}

async function writeNavLabels(data) {
  await db.prepare("INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    .run(NAV_LABELS_KEY, JSON.stringify(data))
}

// Custom sidebar labels for nav items and section headers.
router.get('/nav-labels', async (_req, res) => {
  res.json(await readNavLabels())
})

router.patch('/nav-labels', async (req, res) => {
  const { items = {}, sections = {} } = req.body || {}
  const current = await readNavLabels()

  for (const [path, label] of Object.entries(items)) {
    const trimmed = typeof label === 'string' ? label.trim() : ''
    if (!trimmed) delete current.items[path]
    else current.items[path] = trimmed
  }

  for (const [key, label] of Object.entries(sections)) {
    const trimmed = typeof label === 'string' ? label.trim() : ''
    if (!trimmed) delete current.sections[key]
    else current.sections[key] = trimmed
  }

  await writeNavLabels(current)

  for (const [path, label] of Object.entries(items)) {
    const trimmed = typeof label === 'string' ? label.trim() : ''
    if (!trimmed) continue
    await db.prepare('UPDATE favorites SET label = ? WHERE path = ?').run(trimmed, path)
    await db.prepare('UPDATE recents SET label = ? WHERE path = ?').run(trimmed, path)
  }

  res.json(current)
})

export default router
