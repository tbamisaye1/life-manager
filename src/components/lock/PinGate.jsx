import { useState, useEffect, useCallback } from 'react'
import { PinLock } from './PinLock'
import { isDeviceAuthed, rememberDevice, forgetDevice } from '../../lib/lock'

/**
 * Gates the web app only when the API has APP_PIN set (protected mode).
 * Clones with no APP_PIN run in open demo mode — no keypad.
 */
export function PinGate({ children }) {
  const [status, setStatus] = useState('loading') // loading | locked | unlocked
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let active = true
    const fallback = window.setTimeout(() => {
      if (active) setStatus((s) => (s === 'loading' ? 'locked' : s))
    }, 3000)

    ;(async () => {
      try {
        const res = await fetch('/api/auth/status', { credentials: 'include' })
        const data = res.ok ? await res.json() : { lockEnabled: true, unlocked: false }
        if (!active) return
        if (!data.lockEnabled) {
          setStatus('unlocked')
          return
        }
        if (data.unlocked) {
          rememberDevice()
          setStatus('unlocked')
          return
        }
        if (isDeviceAuthed()) forgetDevice()
        setStatus('locked')
      } catch {
        if (active) setStatus('locked')
      } finally {
        window.clearTimeout(fallback)
      }
    })()

    return () => {
      active = false
      window.clearTimeout(fallback)
    }
  }, [])

  const handleSuccess = useCallback(async (pin) => {
    setBusy(true)
    try {
      const res = await fetch('/api/auth/unlock', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      })
      if (!res.ok) throw new Error('unlock failed')
      rememberDevice()
      setStatus('unlocked')
    } finally {
      setBusy(false)
    }
  }, [])

  if (status === 'loading') {
    return (
      <div className="flex min-h-full items-center justify-center bg-zinc-50">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-200 border-t-accent-500" />
      </div>
    )
  }

  if (status === 'locked') {
    return <PinLock onSuccess={handleSuccess} busy={busy} />
  }

  return children
}
