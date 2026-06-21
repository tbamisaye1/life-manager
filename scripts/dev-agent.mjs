#!/usr/bin/env node
/**
 * Run web + API on alternate ports so multiple agents can test in parallel.
 * Slot 0 = default (5180/4000), slot 1 = 5181/4001, slot 2 = 5182/4002, …
 *
 * Usage: SLOT=2 node scripts/dev-agent.mjs
 *    or: npm run dev:agent -- --slot=2
 */
import { spawn } from 'node:child_process'

const args = process.argv.slice(2)
const slotArg = args.find((a) => a.startsWith('--slot='))
const slot = Number(slotArg?.split('=')[1] ?? process.env.SLOT ?? 1)
const webPort = 5180 + slot
const apiPort = 4000 + slot

const env = {
  ...process.env,
  LM_WEB_PORT: String(webPort),
  LM_API_PORT: String(apiPort),
  LM_DB_SLOT: String(slot),
  PORT: String(apiPort),
}

console.log(`\n  Agent dev slot ${slot} → web :${webPort}, API :${apiPort}\n`)

const child = spawn(
  'npx',
  ['concurrently', '-n', `web:${webPort},api:${apiPort}`, '-c', 'cyan,green', 'npm:dev:web', 'npm:dev:server'],
  { env, stdio: 'inherit', shell: true },
)

child.on('exit', (code) => process.exit(code ?? 0))
