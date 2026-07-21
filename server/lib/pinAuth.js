import { createHmac, timingSafeEqual } from 'node:crypto'
import { httpError } from './http.js'

/** Expected passcode — same as mobile. Override with APP_PIN in env. */
export function expectedPin() {
  return process.env.APP_PIN || ''
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
  const pin = expectedPin()
  const headerPin = req.get('x-life-manager-pin')
  if (headerPin && safeEqual(headerPin, pin)) return true
  const cookies = parseCookies(req.get('cookie') || '')
  return safeEqual(cookies[COOKIE], unlockToken())
}

export function setUnlockCookie(res) {
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
  if (pinAuthExempt(req)) return next()
  if (isUnlocked(req)) return next()
  return res.status(401).json(httpError('Passcode required', 'LOCKED'))
}
