import { createHmac, timingSafeEqual } from 'node:crypto'
import { httpError } from './http.js'

/**
 * Passcode gate is opt-in via APP_PIN.
 * - Unset → public demo mode (clone & run with no lock).
 * - Set (e.g. on Vercel) → API + clients require the passcode.
 * Never hardcode a PIN in source — it would leak when the repo is public.
 */
export function pinRequired() {
  const p = process.env.APP_PIN
  return typeof p === 'string' && p.length > 0
}

export function expectedPin() {
  return pinRequired() ? process.env.APP_PIN : null
}

const COOKIE = 'lm_unlock'

function unlockToken() {
  return createHmac('sha256', expectedPin()).update('life-manager-unlock').digest('hex')
}

function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false
  const ba = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ba.length !== bb.length) return false
  return timingSafeEqual(ba, bb)
}

export function parseCookies(header = '') {
  const out = {}
  for (const part of header.split(';')) {
    const i = part.indexOf('=')
    if (i === -1) continue
    const k = part.slice(0, i).trim()
    const v = part.slice(i + 1).trim()
    if (k) out[k] = decodeURIComponent(v)
  }
  return out
}

export function isUnlocked(req) {
  if (!pinRequired()) return true
  const pin = expectedPin()
  const headerPin = req.get('x-life-manager-pin')
  if (headerPin && safeEqual(headerPin, pin)) return true
  const cookies = parseCookies(req.get('cookie') || '')
  return safeEqual(cookies[COOKIE], unlockToken())
}

export function setUnlockCookie(res) {
  if (!pinRequired()) return
  const secure = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL)
  const parts = [
    `${COOKIE}=${encodeURIComponent(unlockToken())}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${60 * 60 * 24 * 365}`,
  ]
  if (secure) parts.push('Secure')
  res.setHeader('Set-Cookie', parts.join('; '))
}

export function clearUnlockCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`)
}

/** Paths that must work without a PIN (health, unlock, OAuth redirects). */
export function pinAuthExempt(req) {
  const path = req.path || ''
  if (path === '/api/health') return true
  if (path === '/api/auth/unlock' || path === '/api/auth/status') return true
  if (path.startsWith('/api/integrations/') && path.endsWith('/callback')) return true
  return false
}

export function requirePin(req, res, next) {
  if (!pinRequired()) return next()
  if (pinAuthExempt(req)) return next()
  if (isUnlocked(req)) return next()
  return res.status(401).json(httpError('Passcode required', 'LOCKED'))
}
