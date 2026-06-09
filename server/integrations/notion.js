// Notion integration. Supports either a simple internal token (NOTION_TOKEN)
// or full OAuth. Degrades gracefully when nothing is configured. Local storage.
import { Client } from '@notionhq/client'
import { db } from '../db/index.js'
import { newId, now } from '../lib/helpers.js'

export function isConfigured() {
  return Boolean(process.env.NOTION_TOKEN || (process.env.NOTION_CLIENT_ID && process.env.NOTION_CLIENT_SECRET))
}

function storedAccount() {
  return db.prepare("SELECT * FROM integration_accounts WHERE provider = 'notion'").get()
}

function token() {
  if (process.env.NOTION_TOKEN) return process.env.NOTION_TOKEN
  return storedAccount()?.access_token || null
}

export function isConnected() {
  return Boolean(token())
}

export function status() {
  const a = storedAccount()
  return {
    provider: 'notion',
    configured: isConfigured(),
    connected: isConnected(),
    account: a?.account_label || (process.env.NOTION_TOKEN ? 'internal token' : null),
    lastSyncedAt: a?.last_synced_at || null,
  }
}

export function getAuthUrl() {
  if (!process.env.NOTION_CLIENT_ID) return null
  const redirect = process.env.NOTION_REDIRECT_URI || 'http://localhost:4000/api/integrations/notion/callback'
  const u = new URL('https://api.notion.com/v1/oauth/authorize')
  u.searchParams.set('client_id', process.env.NOTION_CLIENT_ID)
  u.searchParams.set('response_type', 'code')
  u.searchParams.set('owner', 'user')
  u.searchParams.set('redirect_uri', redirect)
  return u.toString()
}

export async function handleCallback(code) {
  const redirect = process.env.NOTION_REDIRECT_URI || 'http://localhost:4000/api/integrations/notion/callback'
  const creds = Buffer.from(`${process.env.NOTION_CLIENT_ID}:${process.env.NOTION_CLIENT_SECRET}`).toString('base64')
  const res = await fetch('https://api.notion.com/v1/oauth/token', {
    method: 'POST',
    headers: { Authorization: `Basic ${creds}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ grant_type: 'authorization_code', code, redirect_uri: redirect }),
  })
  if (!res.ok) throw new Error(`Notion token exchange failed: ${res.status}`)
  const data = await res.json()
  const ts = now()
  db.prepare(`INSERT INTO integration_accounts (provider,account_label,access_token,raw,connected_at)
    VALUES ('notion',@label,@access,@raw,@ts)
    ON CONFLICT(provider) DO UPDATE SET account_label=@label, access_token=@access, raw=@raw, connected_at=@ts`).run({
    label: data.workspace_name || 'Notion workspace',
    access: data.access_token,
    raw: JSON.stringify(data),
    ts,
  })
  return { workspace: data.workspace_name }
}

export function disconnect() {
  db.prepare("DELETE FROM integration_accounts WHERE provider = 'notion'").run()
}

function client() {
  const t = token()
  return t ? new Client({ auth: t }) : null
}

/** Helper: read a Notion property into a plain string. */
function readProp(prop) {
  if (!prop) return ''
  switch (prop.type) {
    case 'title': return prop.title.map((t) => t.plain_text).join('')
    case 'rich_text': return prop.rich_text.map((t) => t.plain_text).join('')
    case 'date': return prop.date?.start || ''
    case 'select': return prop.select?.name || ''
    case 'status': return prop.status?.name || ''
    case 'checkbox': return prop.checkbox ? 'done' : 'todo'
    default: return ''
  }
}

/**
 * Pull tasks from a Notion database into local tasks. The user supplies the
 * database id (from the Notion DB URL). Maps common property names heuristically.
 */
export async function syncTasksFromDatabase(databaseId) {
  const notion = client()
  if (!notion || !databaseId) return { synced: 0 }
  const res = await notion.databases.query({ database_id: databaseId, page_size: 100 })
  const ts = now()
  let n = 0
  for (const page of res.results) {
    const props = page.properties || {}
    const titleKey = Object.keys(props).find((k) => props[k].type === 'title')
    const dateKey = Object.keys(props).find((k) => props[k].type === 'date')
    const statusKey = Object.keys(props).find((k) => ['status', 'checkbox'].includes(props[k].type))
    const title = readProp(props[titleKey]) || '(untitled)'
    const due = dateKey ? readProp(props[dateKey]) : ''
    const rawStatus = statusKey ? readProp(props[statusKey]) : 'todo'
    const status = /done|complete/i.test(rawStatus) ? 'done' : 'todo'
    const existing = db.prepare("SELECT id FROM tasks WHERE source='notion' AND external_id=?").get(page.id)
    if (existing) {
      db.prepare(`UPDATE tasks SET title=@title, due_date=@due, status=@status, updated_at=@ts WHERE id=@id`)
        .run({ id: existing.id, title, due: due || null, status, ts })
    } else {
      db.prepare(`INSERT INTO tasks (id,title,status,due_date,priority,recurrence,notes,source,external_id,created_at,updated_at)
        VALUES (@id,@title,@status,@due,'normal','single','','notion',@ext,@ts,@ts)`)
        .run({ id: newId(), title, status, due: due || null, ext: page.id, ts })
    }
    n++
  }
  db.prepare("UPDATE integration_accounts SET last_synced_at=? WHERE provider='notion'").run(ts)
  return { synced: n }
}
