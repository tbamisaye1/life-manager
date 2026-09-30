#!/usr/bin/env node
/**
 * Smoke tests for task subtasks (API + MCP) before production push.
 * Isolated API on TEST_PORT with LM_DB_SLOT=subtasks-test.
 */
import { spawn } from 'node:child_process'
import { setTimeout as sleep } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const PORT = Number(process.env.TEST_PORT || 4098)
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
  try {
    json = JSON.parse(text)
  } catch {
    /* raw */
  }
  return { status: res.status, json, text }
}

async function mcp(method, params, id = 1) {
  return req(
    'POST',
    '/api/mcp',
    {
      jsonrpc: '2.0',
      id,
      method,
      params,
    },
    {
      Authorization: `Bearer ${PIN}`,
      Accept: 'application/json, text/event-stream',
    },
  )
}

function parseMcpToolResult(res) {
  if (res.json?.result?.content?.[0]?.text) {
    try {
      return JSON.parse(res.json.result.content[0].text)
    } catch {
      return res.json.result.content[0].text
    }
  }
  if (res.text?.includes('data:')) {
    const lines = res.text.split('\n').filter((l) => l.startsWith('data:'))
    for (const line of lines) {
      try {
        const msg = JSON.parse(line.slice(5).trim())
        const text = msg?.result?.content?.[0]?.text
        if (text) {
          try {
            return JSON.parse(text)
          } catch {
            return text
          }
        }
      } catch {
        /* next */
      }
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
    } catch {
      /* retry */
    }
    await sleep(250)
  }
  return false
}

async function runTests() {
  console.log('\n=== Subtasks API + MCP smoke tests ===\n')

  {
    const r = await req('GET', '/api/health')
    ok('health', r.status === 200 && r.json?.ok)
  }

  let parent
  {
    const r = await req('POST', '/api/tasks', {
      title: 'TEST CS homework pset 3',
      is_homework: true,
      due_date: '2099-12-01',
    })
    parent = r.json
    ok('create parent', r.status === 201 && parent?.id && !parent.parent_id)
  }

  const childTitles = [
    'TEST email teacher for help',
    'TEST organise office hours and rewatch lecture 2',
    'TEST hand it in in person',
  ]
  const children = []
  for (const title of childTitles) {
    const r = await req('POST', '/api/tasks', { title, parent_id: parent.id })
    ok(`create subtask "${title.slice(5, 30)}…"`, r.status === 201 && r.json?.parent_id === parent.id, JSON.stringify(r.json))
    ok('subtask not homework', Number(r.json?.is_homework) === 0)
    children.push(r.json)
  }

  {
    const r = await req('POST', '/api/tasks', {
      title: 'TEST nested too deep',
      parent_id: children[0].id,
    })
    ok('reject nested subtask', r.status === 400, JSON.stringify(r.json))
  }

  {
    const r = await req('GET', '/api/tasks')
    const all = r.json || []
    const tops = all.filter((t) => !t.parent_id && t.title?.startsWith('TEST '))
    const kids = all.filter((t) => t.parent_id === parent.id)
    const refreshed = all.find((t) => t.id === parent.id)
    ok('list includes parent + children', tops.length >= 1 && kids.length === 3)
    ok('parent subtask_total=3', Number(refreshed?.subtask_total) === 3, JSON.stringify(refreshed))
    ok('parent subtask_done=0', Number(refreshed?.subtask_done) === 0)
  }

  {
    const r = await req('PATCH', `/api/tasks/${children[0].id}`, { status: 'done' })
    ok('complete first subtask', r.status === 200 && r.json?.status === 'done')
    const list = await req('GET', '/api/tasks')
    const refreshed = (list.json || []).find((t) => t.id === parent.id)
    ok('parent progress 1/3', Number(refreshed?.subtask_done) === 1 && Number(refreshed?.subtask_total) === 3)
  }

  {
    const r = await req('GET', '/api/today')
    const ids = [
      ...(r.json?.dueToday || []),
      ...(r.json?.dueThisWeek || []),
      ...(r.json?.homeworkThisWeek || []),
      ...(r.json?.overdue || []),
    ].map((t) => t.id)
    ok('today excludes subtasks', !children.some((c) => ids.includes(c.id)))
  }

  // MCP: create parent with subtasks array
  let mcpParentId = null
  {
    const r = await mcp('tools/call', {
      name: 'create_task',
      arguments: {
        title: 'TEST MCP multi-step project',
        is_homework: true,
        subtasks: ['TEST mcp step A', 'TEST mcp step B'],
      },
    })
    const data = parseMcpToolResult(r)
    mcpParentId = data?.id
    ok('mcp create_task with subtasks', data?.ok && data?.subtask_count === 2, JSON.stringify(data))
  }

  {
    const r = await mcp('tools/call', {
      name: 'list_subtasks',
      arguments: { parent_title: 'TEST MCP multi-step' },
    })
    const data = parseMcpToolResult(r)
    ok('mcp list_subtasks', data?.ok && data?.count === 2, JSON.stringify(data))
  }

  {
    const r = await mcp('tools/call', {
      name: 'list_tasks',
      arguments: { filter: 'all', limit: 100 },
    })
    const data = parseMcpToolResult(r)
    const titles = (data?.tasks || []).map((t) => t.title)
    ok('mcp list_tasks hides children', !titles.includes('TEST mcp step A'))
    ok('mcp list_tasks shows parent', titles.some((t) => t?.includes('TEST MCP multi-step')))
  }

  {
    const r = await mcp('tools/call', {
      name: 'create_task',
      arguments: {
        title: 'TEST mcp child via parent_title',
        parent_title: 'TEST CS homework pset 3',
      },
    })
    const data = parseMcpToolResult(r)
    ok('mcp create under parent_title', data?.ok && data?.parent_id === parent.id, JSON.stringify(data))
  }

  // Cleanup
  const all = await req('GET', '/api/tasks')
  for (const t of all.json || []) {
    if (t.title?.startsWith('TEST ') && !t.parent_id) {
      await req('DELETE', `/api/tasks/${t.id}`)
    }
  }
  if (mcpParentId) await req('DELETE', `/api/tasks/${mcpParentId}`)
  ok('cleanup ran', true)

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`)
  return failed === 0
}

async function main() {
  const __dirname = dirname(fileURLToPath(import.meta.url))
  process.chdir(join(__dirname, '..'))

  const child = spawn('node', ['server/index.js'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      DATABASE_URL: '',
      APP_PIN: PIN,
      MCP_TOKEN: '',
      LM_API_PORT: String(PORT),
      LM_DB_SLOT: 'subtasks-test',
      PORT: String(PORT),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  let bootLog = ''
  child.stdout.on('data', (b) => {
    bootLog += b.toString()
    process.stdout.write(b)
  })
  child.stderr.on('data', (b) => {
    bootLog += b.toString()
    process.stderr.write(b)
  })

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
    try {
      child.kill('SIGKILL')
    } catch {
      /* */
    }
  }
  process.exit(success ? 0 : 1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
