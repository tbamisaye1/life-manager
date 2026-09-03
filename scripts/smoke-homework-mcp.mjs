#!/usr/bin/env node
/**
 * Rigorous smoke tests for homework + MCP before production push.
 * Spawns an isolated API on LM_API_PORT with LM_DB_SLOT=hw-test.
 */
import { spawn } from 'node:child_process'
import { setTimeout as sleep } from 'node:timers/promises'

const PORT = Number(process.env.TEST_PORT || 4099)
const BASE = `http://127.0.0.1:${PORT}`
const PIN = '246810'
let passed = 0
let failed = 0

function ok(name, cond, detail = '') {
  if (cond) {
    passed++
    console.log(`  ✓ ${name}`)
  } else {
    failed++
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

async function req(method, path, body, headers = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Life-Manager-Pin': PIN,
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let json = null
  try { json = JSON.parse(text) } catch { /* raw */ }
  return { status: res.status, json, text, headers: res.headers }
}

async function mcp(method, params, id = 1) {
  return req('POST', '/api/mcp', {
    jsonrpc: '2.0',
    id,
    method,
    params,
  }, {
    Authorization: `Bearer ${PIN}`,
    Accept: 'application/json, text/event-stream',
  })
}

function parseMcpToolResult(res) {
  // Streamable HTTP may return JSON or SSE. Prefer JSON body.
  if (res.json?.result?.content?.[0]?.text) {
    try { return JSON.parse(res.json.result.content[0].text) } catch {
      return res.json.result.content[0].text
    }
  }
  // SSE: look for data: lines with result
  if (res.text?.includes('data:')) {
    const lines = res.text.split('\n').filter((l) => l.startsWith('data:'))
    for (const line of lines) {
      try {
        const msg = JSON.parse(line.slice(5).trim())
        const text = msg?.result?.content?.[0]?.text
        if (text) {
          try { return JSON.parse(text) } catch { return text }
        }
        if (msg?.result) return msg.result
      } catch { /* next */ }
    }
  }
  return res.json
}

async function waitForHealth(ms = 20000) {
  const start = Date.now()
  while (Date.now() - start < ms) {
    try {
      const r = await fetch(`${BASE}/api/health`)
      if (r.ok) return true
    } catch { /* retry */ }
    await sleep(250)
  }
  return false
}

async function runTests() {
  console.log('\n=== Homework + MCP smoke tests ===\n')

  // Health
  {
    const r = await req('GET', '/api/health')
    ok('health', r.status === 200 && r.json?.ok)
  }

  // Auth gate
  {
    const r = await fetch(`${BASE}/api/tasks`)
    ok('rejects without PIN', r.status === 401)
  }

  // Create homework due today
  const today = new Date()
  const y = today.getFullYear()
  const m = String(today.getMonth() + 1).padStart(2, '0')
  const d = String(today.getDate()).padStart(2, '0')
  const todayStr = `${y}-${m}-${d}`

  const week = new Date(today)
  week.setDate(week.getDate() + 3)
  const weekStr = `${week.getFullYear()}-${String(week.getMonth() + 1).padStart(2, '0')}-${String(week.getDate()).padStart(2, '0')}`

  let hwTonight
  {
    const r = await req('POST', '/api/tasks', {
      title: 'TEST HW Problem Set A',
      due_date: todayStr,
      is_homework: true,
      priority: 'high',
      notes: 'smoke test homework tonight',
    })
    hwTonight = r.json
    ok('create homework tonight', r.status === 201 && Number(r.json?.is_homework) === 1, JSON.stringify(r.json))
    ok('homework emoji or title set', !!r.json?.title)
  }

  let hwWeek
  {
    const r = await req('POST', '/api/tasks', {
      title: 'TEST HW Essay Draft',
      due_date: weekStr,
      is_homework: 1,
      priority: 'normal',
    })
    hwWeek = r.json
    ok('create homework this week', r.status === 201 && Number(r.json?.is_homework) === 1)
  }

  let regular
  {
    const r = await req('POST', '/api/tasks', {
      title: 'TEST Regular Errand',
      due_date: todayStr,
      is_homework: false,
    })
    regular = r.json
    ok('create non-homework task', r.status === 201 && Number(r.json?.is_homework) === 0)
  }

  // PATCH toggle homework
  {
    const r = await req('PATCH', `/api/tasks/${regular.id}`, { is_homework: true })
    ok('patch is_homework on', r.status === 200 && Number(r.json?.is_homework) === 1)
    const r2 = await req('PATCH', `/api/tasks/${regular.id}`, { is_homework: false })
    ok('patch is_homework off', r2.status === 200 && Number(r2.json?.is_homework) === 0)
  }

  // Today dashboard buckets
  {
    const r = await req('GET', '/api/today')
    ok('today endpoint', r.status === 200)
    const tonightIds = (r.json?.homeworkTonight || []).map((t) => t.id)
    const weekIds = (r.json?.homeworkThisWeek || []).map((t) => t.id)
    ok('today.homeworkTonight includes tonight HW', tonightIds.includes(hwTonight.id), JSON.stringify(tonightIds))
    ok('today.homeworkThisWeek includes week HW', weekIds.includes(hwWeek.id), JSON.stringify(weekIds))
    ok('today.homeworkThisWeek includes tonight HW', weekIds.includes(hwTonight.id))
    ok('counts.homeworkTonight >= 1', (r.json?.counts?.homeworkTonight || 0) >= 1)
    ok('dueToday includes tonight tasks', (r.json?.dueToday || []).some((t) => t.id === hwTonight.id || t.id === regular.id))
  }

  // List tasks returns is_homework
  {
    const r = await req('GET', '/api/tasks')
    ok('list tasks', r.status === 200 && Array.isArray(r.json))
    const row = r.json.find((t) => t.id === hwTonight.id)
    ok('list includes is_homework field', row && 'is_homework' in row && Number(row.is_homework) === 1)
  }

  // --- MCP ---
  console.log('\n--- MCP ---\n')

  let mcpSessionOk = false
  {
    const r = await mcp('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'smoke', version: '0' },
    })
    // 200 with result, or SSE
    const hasResult = r.status === 200 && (r.json?.result || r.text?.includes('serverInfo') || r.text?.includes('result'))
    ok('mcp initialize', hasResult, `status=${r.status} body=${(r.text || '').slice(0, 200)}`)
    mcpSessionOk = hasResult
  }

  // notifications/initialized (some clients send this)
  {
    const r = await req('POST', '/api/mcp', {
      jsonrpc: '2.0',
      method: 'notifications/initialized',
    }, {
      Authorization: `Bearer ${PIN}`,
      Accept: 'application/json, text/event-stream',
    })
    ok('mcp notifications/initialized accepted or no-op', r.status === 200 || r.status === 202 || r.status === 204 || r.status < 500)
  }

  {
    const r = await mcp('tools/list', {}, 2)
    const names = r.json?.result?.tools?.map((t) => t.name)
      || (() => {
        try {
          const lines = (r.text || '').split('\n').filter((l) => l.startsWith('data:'))
          for (const line of lines) {
            const msg = JSON.parse(line.slice(5).trim())
            if (msg?.result?.tools) return msg.result.tools.map((t) => t.name)
          }
        } catch { /* */ }
        return null
      })()
    ok('mcp tools/list', Array.isArray(names) && names.includes('create_task') && names.includes('get_today'), JSON.stringify(names))
  }

  let mcpCreatedId = null
  {
    const r = await mcp('tools/call', {
      name: 'create_task',
      arguments: {
        title: 'TEST MCP Homework Quiz',
        due_date: todayStr,
        is_homework: true,
        priority: 'urgent',
      },
    }, 3)
    const data = parseMcpToolResult(r)
    mcpCreatedId = data?.id
    ok('mcp create_task homework', r.status === 200 && data?.ok === true && data?.is_homework === true, JSON.stringify(data))
  }

  {
    const r = await mcp('tools/call', {
      name: 'list_tasks',
      arguments: { filter: 'homework_tonight' },
    }, 4)
    const data = parseMcpToolResult(r)
    const titles = (data?.tasks || []).map((t) => t.title)
    ok(
      'mcp list_tasks homework_tonight',
      Array.isArray(data?.tasks) && titles.some((t) => t.includes('MCP Homework') || t.includes('Problem Set')),
      JSON.stringify(titles).slice(0, 300),
    )
  }

  {
    const r = await mcp('tools/call', {
      name: 'get_today',
      arguments: {},
    }, 5)
    const data = parseMcpToolResult(r)
    ok('mcp get_today', data?.date === todayStr && Array.isArray(data?.homework_tonight), JSON.stringify({ date: data?.date, n: data?.homework_tonight?.length }))
  }

  {
    const r = await mcp('tools/call', {
      name: 'complete_task',
      arguments: { title: 'MCP Homework Quiz' },
    }, 6)
    const data = parseMcpToolResult(r)
    ok('mcp complete_task', data?.ok === true, JSON.stringify(data))
  }

  {
    const r = await mcp('tools/call', {
      name: 'update_task',
      arguments: { title: 'Essay Draft', is_homework: true, priority: 'high' },
    }, 7)
    const data = parseMcpToolResult(r)
    ok('mcp update_task', data?.ok === true, JSON.stringify(data))
  }

  // Bearer auth specifically
  {
    const r = await fetch(`${BASE}/api/tasks`, {
      headers: { Authorization: `Bearer ${PIN}` },
    })
    ok('Bearer APP_PIN unlocks REST', r.status === 200)
  }

  // Cleanup test tasks
  const all = await req('GET', '/api/tasks')
  for (const t of all.json || []) {
    if (t.title?.startsWith('TEST ')) {
      await req('DELETE', `/api/tasks/${t.id}`)
    }
  }
  if (mcpCreatedId) await req('DELETE', `/api/tasks/${mcpCreatedId}`)
  ok('cleanup ran', true)

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`)
  return failed === 0
}

async function main() {
  const child = spawn('node', ['server/index.js'], {
    cwd: new URL('..', import.meta.url).pathname.replace(/\/scripts\/?$/, '') || process.cwd(),
    env: {
      ...process.env,
      DATABASE_URL: '', // force PGlite even if .env has Neon
      APP_PIN: PIN,
      MCP_TOKEN: '',
      LM_API_PORT: String(PORT),
      LM_DB_SLOT: 'hw-test',
      PORT: String(PORT),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  let bootLog = ''
  child.stdout.on('data', (b) => { bootLog += b.toString(); process.stdout.write(b) })
  child.stderr.on('data', (b) => { bootLog += b.toString(); process.stderr.write(b) })

  const up = await waitForHealth()
  if (!up) {
    console.error('Server failed to become healthy.\n', bootLog.slice(-2000))
    child.kill('SIGTERM')
    process.exit(1)
  }

  let success = false
  try {
    success = await runTests()
  } finally {
    child.kill('SIGTERM')
    await sleep(500)
    try { child.kill('SIGKILL') } catch { /* */ }
  }
  process.exit(success ? 0 : 1)
}

// Fix cwd: script lives in scripts/
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
const __dirname = dirname(fileURLToPath(import.meta.url))
process.chdir(join(__dirname, '..'))

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
