import { Router } from 'express'
import { timingSafeEqual } from 'node:crypto'
import { httpError } from '../lib/http.js'
import {
  pinRequired,
  expectedPin,
  isUnlocked,
  setUnlockCookie,
  clearUnlockCookie,
} from '../lib/pinAuth.js'

const router = Router()

function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false
  const ba = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ba.length !== bb.length) return false
  return timingSafeEqual(ba, bb)
}

router.get('/status', (req, res) => {
  const enabled = pinRequired()
  res.json({
    lockEnabled: enabled,
    unlocked: !enabled || isUnlocked(req),
    mode: enabled ? 'protected' : 'demo',
  })
})

router.post('/unlock', (req, res) => {
  if (!pinRequired()) {
    return res.json({ ok: true, mode: 'demo' })
  }
  const pin = String(req.body?.pin || '')
  if (!safeEqual(pin, expectedPin())) {
    return res.status(401).json(httpError('Wrong passcode', 'BAD_PIN'))
  }
  setUnlockCookie(res)
  res.json({ ok: true, mode: 'protected' })
})

router.post('/lock', (_req, res) => {
  clearUnlockCookie(res)
  res.json({ ok: true })
})

export default router
