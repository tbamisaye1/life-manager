import { cn } from '../../lib/cn'

/** Tiny labeled metric pill used in SessionCard and the summary strip. */
export function StatPill({ label, value, className }) {
  return (
    <span
      className={cn(
        'inline-flex flex-col items-center rounded-lg bg-zinc-100 px-2.5 py-1 text-center',
        className,
      )}
    >
      <span className="text-xs font-semibold leading-tight text-zinc-800">{value}</span>
      <span className="text-xs leading-tight text-zinc-400">{label}</span>
    </span>
  )
}
