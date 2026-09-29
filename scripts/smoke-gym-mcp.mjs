#!/usr/bin/env node
/**
 * Rigorous smoke tests for gym MCP + REST before production push.
 * Spawns an isolated API on TEST_PORT with LM_DB_SLOT=gym-test.
 */
import { spawn } from 'node:child_process'
import { setTimeout as sleep } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const PORT = Number(process.env.TEST_PORT || 4101)
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
    { jsonrpc: '2.0', id, method, params },
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
        if (msg?.result) return msg.result
      } catch {
        /* next */
      }
    }
  }
  return res.json
}

async function callTool(name, args = {}) {
  const r = await mcp('tools/call', { name, arguments: args })
  return { status: r.status, data: parseMcpToolResult(r), raw: r }
}

async function waitForHealth(ms = 25000) {
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
  console.log('\n=== Gym MCP + REST smoke tests ===\n')
  const RUN = `T${Date.now().toString(36).slice(-5)}`
  const BENCH = `${RUN} Bench Press`
  const OHP = `${RUN} Overhead Press`
  const PUSH = `${RUN} Push`
  const FROM = `${RUN} From Workout`
  const CURL = `${RUN} Curl`
  const ARMS = `${RUN} Arms`

  {
    const r = await req('GET', '/api/health')
    ok('health', r.status === 200 && r.json?.ok)
  }

  // MCP initialize + tools/list includes gym tools
  {
    const r = await mcp('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'gym-smoke', version: '0' },
    })
    ok('mcp initialize', r.status === 200 && (r.json?.result || r.text?.includes('serverInfo')))
  }

  let toolNames = []
  {
    const r = await mcp('tools/list', {})
    const tools = r.json?.result?.tools || parseMcpToolResult(r)?.tools || []
    // SSE path
    if (!tools.length && r.text?.includes('data:')) {
      const lines = r.text.split('\n').filter((l) => l.startsWith('data:'))
      for (const line of lines) {
        try {
          const msg = JSON.parse(line.slice(5).trim())
          if (msg?.result?.tools) {
            toolNames = msg.result.tools.map((t) => t.name)
            break
          }
        } catch {
          /* */
        }
      }
    } else {
      toolNames = (tools || []).map((t) => t.name)
    }
    const required = [
      'list_exercises',
      'create_exercise',
      'update_exercise',
      'set_exercise_goal',
      'log_exercise',
      'log_set',
      'update_set',
      'delete_set',
      'clear_exercise_sets',
      'get_gym_today',
      'list_routines',
      'create_routine',
      'update_routine',
      'add_exercise_to_routine',
      'remove_exercise_from_routine',
      'update_routine_exercise',
      'reorder_routine_exercises',
      'start_workout',
      'finish_workout',
      'update_workout',
      'get_workout',
      'delete_workout',
      'get_exercise_history',
      'append_exercise_notes',
      'archive_exercise',
      'create_routine_from_workout',
      'get_gym_schedule',
    ]
    ok('tools/list has gym tools', toolNames.length > 20, `count=${toolNames.length}`)
    for (const name of required) {
      ok(`tool registered: ${name}`, toolNames.includes(name))
    }
  }

  // Create exercise via MCP
  {
    const d = (await callTool('create_exercise', {
      name: BENCH,
      category: 'strength',
      unit: 'kg',
      muscle_group: 'chest',
      rep_low: 5,
      rep_high: 8,
      default_sets: 4,
      target_weight: 60,
      notes: 'elbows tucked',
    })).data
    ok('create_exercise', d?.ok && d?.name === BENCH, JSON.stringify(d))
  }

  {
    const d = (await callTool('list_exercises', { query: RUN })).data
    ok('list_exercises finds created', d?.exercises?.some((e) => e.name === BENCH), JSON.stringify(d))
  }

  {
    const d = (await callTool('set_exercise_goal', {
      exercise_name: BENCH,
      goal: '5x5@70kg',
    })).data
    ok('set_exercise_goal', d?.ok, JSON.stringify(d))
    const g = (await callTool('get_exercise', { name_or_id: BENCH })).data
    ok('get_exercise shows goal', g?.exercise?.default_sets === 5 && Number(g?.exercise?.target_weight) === 70, JSON.stringify(g))
  }

  {
    const d = (await callTool('append_exercise_notes', {
      exercise_name: BENCH,
      notes: 'pause at bottom',
    })).data
    ok('append_exercise_notes', d?.ok, JSON.stringify(d))
    const g = (await callTool('get_exercise', { name_or_id: BENCH })).data
    ok('notes appended', String(g?.exercise?.notes || '').includes('pause at bottom'), JSON.stringify(g))
  }

  // Routine CRUD
  {
    const d = (await callTool('create_routine', {
      name: PUSH,
      weekday: 1,
      emoji: '💪',
      notes: 'chest focus',
    })).data
    ok('create_routine', d?.ok && d?.id, JSON.stringify(d))
  }

  {
    const d = (await callTool('add_exercise_to_routine', {
      routine_name: PUSH,
      exercise_name: BENCH,
      target_sets: 4,
    })).data
    ok('add_exercise_to_routine', d?.ok, JSON.stringify(d))
  }

  {
    const d = (await callTool('create_exercise', {
      name: OHP,
      unit: 'kg',
    })).data
    ok('create second exercise', d?.ok)
    const a = (await callTool('add_exercise_to_routine', {
      routine_name: PUSH,
      exercise_name: OHP,
      target_sets: 3,
    })).data
    ok('add OHP to routine', a?.ok)
  }

  {
    const d = (await callTool('update_routine_exercise', {
      routine_name: PUSH,
      exercise_name: BENCH,
      target_sets: 5,
    })).data
    ok('update_routine_exercise target_sets', d?.ok && d?.target_sets === 5, JSON.stringify(d))
  }

  {
    const d = (await callTool('reorder_routine_exercises', {
      routine_name: PUSH,
      exercise_names: [OHP, BENCH],
    })).data
    ok('reorder_routine_exercises', d?.ok, JSON.stringify(d))
    const r = (await callTool('get_routine', { routine_name: PUSH })).data
    const names = (r?.routine?.exercises || []).map((e) => e.name)
    ok('reorder applied', names[0] === OHP && names[1] === BENCH, JSON.stringify(names))
  }

  {
    const d = (await callTool('update_routine', {
      routine_name: PUSH,
      append_notes: 'warm up shoulders',
      weekday: 3,
    })).data
    ok('update_routine notes+weekday', d?.ok, JSON.stringify(d))
  }

  // Logging
  {
    const d = (await callTool('log_exercise', {
      exercise_name: BENCH,
      notation: '3x8@60kg',
      notes: 'solid',
    })).data
    ok('log_exercise notation', d?.ok && d?.total_sets === 3, JSON.stringify(d))
  }

  {
    const d = (await callTool('log_exercise', {
      exercise_name: OHP,
      groups: [{ notation: '2x10@30kg' }, { notation: '1x8@35kg' }],
    })).data
    ok('log_exercise groups', d?.ok && d?.total_sets === 3, JSON.stringify(d))
  }

  {
    const d = (await callTool('get_gym_today', {})).data
    ok('get_gym_today has workout', d?.ok && d?.workouts?.length >= 1, JSON.stringify(d?.workouts?.length))
    const bench = d?.workouts?.[0]?.exercises?.find((e) => e.exercise === BENCH)
    ok('today has bench sets', bench?.sets === 3, JSON.stringify(bench))
  }

  {
    const d = (await callTool('update_set', {
      exercise_name: BENCH,
      set_number: 2,
      weight: 62.5,
      reps: 7,
      append_notes: 'felt heavy',
    })).data
    ok('update_set', d?.ok, JSON.stringify(d))
  }

  {
    const d = (await callTool('delete_set', {
      exercise_name: BENCH,
      set_number: 3,
    })).data
    ok('delete_set', d?.ok, JSON.stringify(d))
    const today = (await callTool('get_gym_today', {})).data
    const bench = today?.workouts?.[0]?.exercises?.find((e) => e.exercise === BENCH)
    ok('sets renumbered after delete', bench?.sets === 2 && bench?.set_details?.[1]?.set_number === 2, JSON.stringify(bench))
  }

  {
    const d = (await callTool('log_exercise', {
      exercise_name: BENCH,
      notation: '4x5@65kg',
      replace: true,
    })).data
    ok('log_exercise replace', d?.ok && d?.total_sets === 4 && d?.replaced === true, JSON.stringify(d))
  }

  {
    const d = (await callTool('update_workout', {
      append_notes: 'great session',
      title: `${PUSH} Day`,
    })).data
    ok('update_workout', d?.ok, JSON.stringify(d))
  }

  {
    const d = (await callTool('finish_workout', {})).data
    ok('finish_workout', d?.ok, JSON.stringify(d))
  }

  {
    const d = (await callTool('get_exercise_history', { exercise_name: BENCH })).data
    ok('get_exercise_history', d?.ok && (d?.sessions?.length || 0) >= 1, JSON.stringify(d?.sessions?.length))
  }

  {
    const d = (await callTool('create_routine_from_workout', {
      name: FROM,
      weekday: 5,
    })).data
    ok('create_routine_from_workout', d?.ok && d?.id, JSON.stringify(d))
  }

  {
    const d = (await callTool('get_gym_schedule', {})).data
    ok('get_gym_schedule', d?.ok && Array.isArray(d?.days) && d.days.length === 7, JSON.stringify(d?.days?.length))
  }

  {
    const d = (await callTool('search', { query: RUN })).data
    ok('search finds gym exercise', d?.exercises?.some((e) => e.name === BENCH || e.name.includes(RUN)), JSON.stringify(d?.exercises))
  }

  // REST parity: patch routine exercise + delete set renumbers
  let restWorkoutId
  let restExId
  let restRexId
  {
    const ex = await req('POST', '/api/gym/exercises', { name: CURL, unit: 'kg', default_sets: 3 })
    ok('REST create exercise', ex.status === 201 && ex.json?.id)
    restExId = ex.json?.id
    const routine = await req('POST', '/api/gym/routines', { name: ARMS, weekday: 2 })
    ok('REST create routine', routine.status === 201 && routine.json?.id)
    const add = await req('POST', `/api/gym/routines/${routine.json.id}/exercises`, {
      exercise_id: restExId,
      target_sets: 3,
    })
    ok('REST add routine exercise', add.status === 201)
    restRexId = add.json?.exercises?.find((e) => e.id === restExId)?.routine_exercise_id
    const patch = await req('PATCH', `/api/gym/routines/${routine.json.id}/exercises/${restRexId}`, { target_sets: 6 })
    ok('REST patch routine exercise target_sets', patch.status === 200 && patch.json?.exercises?.some((e) => e.routine_exercise_id === restRexId && e.target_sets === 6), JSON.stringify(patch.json?.exercises))

    const workout = await req('POST', '/api/gym/workouts', { title: `${RUN} Session` })
    ok('REST create workout', workout.status === 201)
    restWorkoutId = workout.json?.id
    for (let i = 0; i < 3; i++) {
      await req('POST', `/api/gym/workouts/${restWorkoutId}/sets`, {
        exercise_id: restExId,
        weight: 20,
        reps: 10,
      })
    }
    const full = await req('GET', `/api/gym/workouts/${restWorkoutId}`)
    const sets = full.json?.exercises?.find((e) => e.exercise.id === restExId)?.sets || []
    ok('REST logged 3 sets', sets.length === 3)
    const mid = sets[1]
    const del = await req('DELETE', `/api/gym/sets/${mid.id}`)
    ok('REST delete middle set', del.status === 200)
    const after = await req('GET', `/api/gym/workouts/${restWorkoutId}`)
    const afterSets = after.json?.exercises?.find((e) => e.exercise.id === restExId)?.sets || []
    ok('REST sets renumbered', afterSets.length === 2 && afterSets[0].set_number === 1 && afterSets[1].set_number === 2, JSON.stringify(afterSets.map((s) => s.set_number)))
  }

  // Cleanup destructive tools
  {
    const d = (await callTool('clear_exercise_sets', { exercise_name: BENCH })).data
    ok('clear_exercise_sets', d?.ok, JSON.stringify(d))
  }

  {
    const d = (await callTool('remove_exercise_from_routine', {
      routine_name: PUSH,
      exercise_name: OHP,
    })).data
    ok('remove_exercise_from_routine', d?.ok, JSON.stringify(d))
  }

  {
    const d = (await callTool('archive_exercise', { exercise_name: OHP })).data
    ok('archive_exercise', d?.ok, JSON.stringify(d))
    const list = (await callTool('list_exercises', { query: OHP })).data
    ok('archived hidden from default list', !(list?.exercises || []).some((e) => e.name === OHP))
  }

  {
    const d = (await callTool('delete_routine', { routine_name: PUSH })).data
    ok('delete_routine', d?.ok, JSON.stringify(d))
  }

  {
    const d = (await callTool('delete_routine', { routine_name: FROM })).data
    ok('delete from-workout routine', d?.ok)
  }

  {
    const d = (await callTool('delete_workout', { all: true })).data
    ok('delete_workout all', d?.ok && d?.deleted >= 1, JSON.stringify(d))
  }

  {
    await callTool('delete_exercise', { exercise_name: BENCH })
    await callTool('delete_exercise', { exercise_name: OHP })
    if (restExId) await req('DELETE', `/api/gym/exercises/${restExId}`)
    ok('cleanup exercises', true)
  }

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`)
  return failed === 0
}

async function main() {
  const child = spawn('node', ['server/index.js'], {
    cwd: join(dirname(fileURLToPath(import.meta.url)), '..'),
    env: {
      ...process.env,
      DATABASE_URL: '',
      APP_PIN: PIN,
      MCP_TOKEN: '',
      LM_API_PORT: String(PORT),
      LM_DB_SLOT: 'gym-test',
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

const __dirname = dirname(fileURLToPath(import.meta.url))
process.chdir(join(__dirname, '..'))
main().catch((err) => {
  console.error(err)
  process.exit(1)
})
