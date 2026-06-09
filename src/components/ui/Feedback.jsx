import { Loader2, AlertTriangle } from 'lucide-react'
import { cn } from '../../lib/cn'

export function Spinner({ className }) {
  return <Loader2 className={cn('h-4 w-4 animate-spin text-zinc-400', className)} />
}

/** Centered loading state for a panel/page. */
export function Loading({ label = 'Loading…', className }) {
  return (
    <div className={cn('flex items-center justify-center gap-2 py-12 text-sm text-zinc-400', className)}>
      <Spinner /> {label}
    </div>
  )
}

/** Inline error state with optional retry. */
export function ErrorState({ message = 'Something went wrong', onRetry, className }) {
  return (
    <div className={cn('flex flex-col items-center gap-2 rounded-xl border border-red-100 bg-red-50/50 py-10 text-center', className)}>
      <AlertTriangle className="h-5 w-5 text-red-400" />
      <p className="text-sm text-red-600">{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="text-sm font-medium text-accent-600 hover:underline focus-ring">
          Try again
        </button>
      )}
    </div>
  )
}
