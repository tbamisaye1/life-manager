import { cn } from '../../lib/cn'

/** Thin progress bar (0-100). Used for improvement goals + rugby skills. */
export function ProgressBar({ value = 0, className, barClassName }) {
  const pct = Math.max(0, Math.min(100, value))
  return (
    <div className={cn('h-1.5 w-full overflow-hidden rounded-full bg-zinc-100', className)}>
      <div
        className={cn('h-full rounded-full bg-accent-500 transition-all', barClassName)}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}
