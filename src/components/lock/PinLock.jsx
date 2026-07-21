import { useState, useCallback } from 'react'
import { Delete, Lock } from 'lucide-react'
import { PIN_LENGTH, checkPin } from '../../lib/lock'
import { cn } from '../../lib/cn'

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del']

export function PinLock({ onSuccess, busy = false }) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)
  const [shake, setShake] = useState(false)

  const triggerShake = useCallback(() => {
    setError(true)
    setShake(true)
    window.setTimeout(() => setShake(false), 400)
  }, [])

  async function submit(next) {
    if (!checkPin(next)) {
      triggerShake()
      window.setTimeout(() => setPin(''), 350)
      return
    }
    try {
      await onSuccess(next)
    } catch {
      triggerShake()
      window.setTimeout(() => setPin(''), 350)
    }
  }

  function press(key) {
    if (busy || key === '') return
    if (key === 'del') {
      setError(false)
      setPin((p) => p.slice(0, -1))
      return
    }
    if (pin.length >= PIN_LENGTH) return
    const next = pin + key
    setError(false)
    setPin(next)
    if (next.length === PIN_LENGTH) submit(next)
  }

  return (
    <div className="flex min-h-full flex-col items-center justify-between bg-zinc-50 px-6 py-16">
      <div className="flex w-full max-w-sm flex-col items-center gap-3 pt-8">
        <div className="mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-accent-50 text-accent-600">
          <Lock className="h-6 w-6" strokeWidth={2} />
        </div>
        <h1 className="text-xl font-semibold text-zinc-800">Enter passcode</h1>
        <p className="text-sm text-zinc-500">
          {error ? 'Wrong passcode — try again' : 'Life Manager is locked'}
        </p>

        <div
          className={cn('mt-8 flex gap-3', shake && 'animate-[shake_0.35s_ease-in-out]')}
          aria-label={`${pin.length} of ${PIN_LENGTH} digits entered`}
        >
          {Array.from({ length: PIN_LENGTH }).map((_, i) => (
            <span
              key={i}
              className={cn(
                'h-4 w-4 rounded-full border-2 transition-colors',
                i < pin.length
                  ? error
                    ? 'border-red-500 bg-red-500'
                    : 'border-accent-500 bg-accent-500'
                  : error
                    ? 'border-red-400 bg-transparent'
                    : 'border-zinc-300 bg-transparent',
              )}
            />
          ))}
        </div>
      </div>

      <div className="grid w-full max-w-sm grid-cols-3 gap-y-2 pb-8">
        {KEYS.map((key, i) => {
          if (key === '') return <div key={i} />
          return (
            <button
              key={i}
              type="button"
              disabled={busy}
              onClick={() => press(key)}
              className="flex h-[72px] items-center justify-center rounded-xl text-3xl font-medium text-zinc-800 transition-opacity hover:bg-zinc-100 active:opacity-40 disabled:opacity-40"
            >
              {key === 'del' ? <Delete className="h-7 w-7 text-zinc-700" /> : key}
            </button>
          )
        })}
      </div>
    </div>
  )
}
